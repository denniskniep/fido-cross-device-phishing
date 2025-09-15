use std::option::Option;
use sha2::{Digest, Sha256};
use axum::extract::State;
use axum::response::{IntoResponse, Response};
use axum::Json;
use http::StatusCode;
use libwebauthn::transport::cable::channel::{CableUpdate, CableUxUpdate};
use std::sync::Arc;
use std::time::Duration;
use ts_io::Base64Url;
use serde_bytes::ByteBuf;
use libwebauthn::transport::cable::qr_code_device::{CableQrCodeDevice, QrCodeOperationHint};
use rand::{TryRngCore};
use tokio::sync::broadcast::Receiver;
use tokio::time::sleep;
use crate::handler_advertisement::Advertisement;
use crate::AppState;
use libwebauthn::ops::webauthn::{GetAssertionRequest, GetAssertionResponse, UserVerificationRequirement};
use libwebauthn::proto::ctap2::{Ctap2PublicKeyCredentialDescriptor, Ctap2PublicKeyCredentialType};
use libwebauthn::transport::cable::advertisement::DecryptedAdvert;
use libwebauthn::transport::cable::connection_stages::{ProximityCheckInput, ProximityCheckOutput};
use libwebauthn::transport::cable::crypto::trial_decrypt_advert;
use libwebauthn::transport::{Channel as _};
use libwebauthn::webauthn::{Error, WebAuthn};
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;
use tracing::{debug, error, info};
use uuid::Uuid;

pub async fn pre_auth(
    State(state): State<AppState>,
) -> (StatusCode, Json<FidoPreAuthResponse>) {
    let fido_auth = create_fido_auth();

    let pre_auth_response = FidoPreAuthResponse {
        id: fido_auth.id.clone(),
        url: fido_auth.url.clone()
    };

    let mut fido_authentications: tokio::sync::MutexGuard<'_, Vec<FidoAuth>> = state.fido_authentications.lock().await;
    fido_authentications.push(fido_auth);

    (StatusCode::OK, Json(pre_auth_response))
}

pub async fn auth(
    State(state): State<AppState>,
    Json(payload): Json<FidoAuthRequest>,
) -> Response {

    let fido_authentications: tokio::sync::MutexGuard<'_, Vec<FidoAuth>> = state.fido_authentications.lock().await;
    for auth in fido_authentications.iter() {
        if(auth.id == payload.id) {
            let proximity_check = exec_proximity_check(state.advertisements, &auth).await;

            let uv = match payload.request.user_verification.as_str() {
                "required" => {UserVerificationRequirement::Required}
                "preferred" => {UserVerificationRequirement::Preferred}
                "discouraged" => {UserVerificationRequirement::Discouraged}
                // TODO: Error?
                s => {UserVerificationRequirement::Preferred}
            };

            let mut allowed_credentials = vec![];
            for allowed_credential in payload.request.allowed_credentials.iter() {
                allowed_credentials.push(Ctap2PublicKeyCredentialDescriptor{
                    id: ByteBuf::from(allowed_credential.id.clone()),
                    r#type: Ctap2PublicKeyCredentialType::PublicKey,
                    // TODO: use transports from request!
                    transports: None,
                })
            }
            
            let client_data = ClientData{
                 r#type: String::from("webauthn.get"),
                 origin: payload.request.origin,
                 cross_origin: Some(false),
                 challenge: Base64Url::from(payload.request.challenge),
                 top_origin: None,
            };

            let client_data_json = serde_json::to_vec(&client_data).unwrap();
            let client_data_json_hash = Sha256::digest(&client_data_json).to_vec();

            let get_assertion = GetAssertionRequest {
                relying_party_id: payload.request.rp_id.clone(),
                hash: client_data_json_hash,
                allow: vec![],
                user_verification: uv,
                extensions: None,
                timeout: Duration::from_millis(payload.request.timeout),
            };


            debug!("CTAP Request  {:?}", get_assertion);
            let assertions = process_fido_auth(auth.clone(),get_assertion, proximity_check).await.unwrap();
            let assertion = &assertions.assertions[0];

            let user_handle = match &assertion.user {
                None => {None}
                Some(u) => {Some(Base64Url::from(u.id.to_vec()))}
            };

            let credential_id = match &assertion.credential_id {
                None => {None}
                Some(cred) => {Some(Base64Url::from(cred.id.to_vec()))}
            };

            let assertion_response = AssertionResponse{
                client_data_json: Base64Url::from(client_data_json),
                signature: Base64Url::from(assertion.signature.clone()),
                authenticator_data: Base64Url::from(assertion.authenticator_data.to_response_bytes().unwrap()),
                user_handle
            };

            let auth_response = FidoAuthResponse {
                r#type: String::from("public-key"),
                authenticator_attachment: String::from("cross-platform"),
                id: credential_id.clone(),
                raw_id: credential_id.clone(),
                response: assertion_response,
            };
            debug!("CTAP Response  {:?}", auth_response);
            return (StatusCode::OK, Json(auth_response)).into_response();
        }
    }
    (StatusCode::NOT_FOUND).into_response()
}

async fn exec_proximity_check( advertisements: Arc<Mutex<Vec<Advertisement>>>, auth: &FidoAuth) -> ProximityCheckOutput {
    let proximity_input = ProximityCheckInput::new_for_qr_code(&auth.device);

    let wait_for = Duration::from_millis(2000);
    let mut timeout = Duration::from_secs(120);

    let mut proximity_check: Option<ProximityCheckOutput> = None;
    let mut proximity_found = false;
    while wait_for < timeout && !proximity_found {
        let advertisements: tokio::sync::MutexGuard<'_, Vec<Advertisement>> = advertisements.lock().await;
        let tmp_advertisements = advertisements.clone();
        info!("checking {:?} advertisements", tmp_advertisements.len());
        drop(advertisements);
        for adv in tmp_advertisements {
            let data = &adv.data;
            let Some(decrypted) = trial_decrypt_advert(&proximity_input.eid_key, data) else {
                continue;
            };
            let advert = DecryptedAdvert::from(decrypted);
            proximity_check = Some(ProximityCheckOutput {
                advert
            });
            proximity_found = true;
            break;
        }

        sleep(wait_for).await;
        timeout += wait_for
    };

    let proximity_check = proximity_check.unwrap();
    proximity_check
}

fn create_fido_auth() -> FidoAuth {
    let id = Uuid::new_v4().to_string();

    let device: CableQrCodeDevice = CableQrCodeDevice::new_transient(
        QrCodeOperationHint::GetAssertionRequest
    );

    info!("Generated: {}", device.qr_code.to_string());

    let url = device.qr_code.to_string().clone();
    let fido_auth = FidoAuth {
        id,
        device,
        url
    };

    fido_auth
}

async fn process_fido_auth(mut fido_authentication: FidoAuth, get_assertion : GetAssertionRequest, proximity_check: ProximityCheckOutput) -> Result<GetAssertionResponse, Error> {
    let mut channel = fido_authentication.device.channel_without_proximity_check(proximity_check).await?;

    let state_recv = channel.get_ux_update_receiver();
    tokio::spawn(handle_updates(state_recv));

    match channel
            .webauthn_get_assertion(&get_assertion)
            .await
        {
            Ok(response) => Ok(response),
            Err(err) =>{
                error!("Error {:?}", err);
                Err(err)
            }
        }
}

async fn handle_updates(mut state_recv: Receiver<CableUxUpdate>) {
    while let Ok(update) = state_recv.recv().await {
        match update {
            CableUxUpdate::UvUpdate(_) => return,
            CableUxUpdate::CableUpdate(cable_update) => match cable_update {
                CableUpdate::ProximityCheck => info!("Proximity check in progress..."),
                CableUpdate::Connecting => info!("Connecting to the device..."),
                CableUpdate::Authenticating =>info!("Authenticating with the device..."),
                CableUpdate::Connected => info!("Tunnel established successfully!"),
                CableUpdate::Error(err) => info!("Error during connection: {}", err),
            },
        }
    }
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct FidoPreAuthResponse {
    id: String,
    url: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct FidoAuthRequest {
    id: String,
    request: WebauthnRequest,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WebauthnRequest {
    rp_id: String,
    origin: String,
    timeout: u64,
    user_verification: String,
    allowed_credentials : Vec<WebAuthnAllowedCredential>,
    #[serde(with="base64")]
    pub(crate) challenge: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebAuthnAllowedCredential {
    #[serde(with="base64")]
    pub(crate) id: Vec<u8>,

    transports: Vec<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FidoAuthResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    id: Option<Base64Url>,

    #[serde(skip_serializing_if = "Option::is_none")]
    raw_id: Option<Base64Url>,

    authenticator_attachment: String,
    r#type: String,
    response: AssertionResponse,
}

#[derive(Clone)]
pub struct FidoAuth {
    id: String,
    url: String,
    device: CableQrCodeDevice,
}

/// <https://w3c.github.io/webauthn/#dictionary-client-data>
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientData {
    /// The operation type that generated this client data, should be one of:
    /// * `webauthn.create`
    /// * `webauthn.get`
    pub r#type: String,
    /// The challenge that was issued to the authenticator.
    pub challenge: Base64Url,
    /// The origin the request came from.
    pub origin: String,
    /// If the request is a cross origin request.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cross_origin: Option<bool>,
    /// The top origin of a cross origin request.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_origin: Option<String>,
}

/// <https://w3c.github.io/webauthn/#iface-authenticatorassertionresponse>
/// <https://w3c.github.io/webauthn/#dictdef-authenticatorassertionresponsejson>
#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssertionResponse {
    /// `Base64` encoded JSON serialized client data.
    #[serde(rename = "clientDataJSON")]
    pub client_data_json: Base64Url,
    /// `Base64` encoded authenticator data.
    pub authenticator_data: Base64Url,
    /// The signature.
    pub signature: Base64Url,
    /// The user handle if known.
    pub user_handle: Option<Base64Url>,
}

pub mod base64 {
    use serde::{Serialize, Deserialize};
    use serde::{Deserializer, Serializer};

    pub fn serialize<S: Serializer>(v: &Vec<u8>, s: S) -> Result<S::Ok, S::Error> {
        let base64 = base64::encode(v);
        String::serialize(&base64, s)
    }

    pub fn deserialize<'de, D: Deserializer<'de>>(d: D) -> Result<Vec<u8>, D::Error> {
        let base64 = String::deserialize(d)?;
        base64::decode(base64.as_bytes())
            .map_err(|e| serde::de::Error::custom(e))
    }
}
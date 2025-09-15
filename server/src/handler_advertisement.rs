use axum::extract::State;
use axum::Json;
use axum_auth::AuthBasic;
use http::StatusCode;
use serde::{Deserialize, Serialize};
use tracing::debug;
use crate::AppState;

pub async fn send(
    State(state): State<AppState>,
    credentials: AuthBasic,
    Json(payload): Json<Advertisement>,
) -> StatusCode {
    // TODO: Auth as middleware!
    if(!check_beacon_auth(credentials)){
        return StatusCode::UNAUTHORIZED
    }
    let mut advertisements: tokio::sync::MutexGuard<'_, Vec<Advertisement>> = state.advertisements.lock().await;
    advertisements.push(payload);
    debug!("received advertisements: {:?}.", advertisements);
    StatusCode::CREATED
}

fn check_beacon_auth(AuthBasic((id, password)): AuthBasic) -> bool {
    if(id == "beacon"){
        return match password {
            None => false,
            Some(password) => password == "123456"
        }
    }
    false
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Advertisement {
    beacon: String,
    address: String,
    uuid: String,
    #[serde(with="base64")]
    pub(crate) data: Vec<u8>
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
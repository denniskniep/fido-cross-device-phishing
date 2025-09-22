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

    let username = state.args.username.clone();
    let password = state.args.password.clone();

    if(username != "" && password != "") {
        if(!check_beacon_auth(username, password, credentials)){
            return StatusCode::UNAUTHORIZED
        }
    }

    let mut advertisements: tokio::sync::MutexGuard<'_, Vec<Advertisement>> = state.advertisements.lock().await;
    advertisements.push(payload);
    debug!("received advertisements: {:?}.", advertisements);
    StatusCode::CREATED
}

fn check_beacon_auth(username : String, password : String, AuthBasic((providedUser, providedPassword)): AuthBasic) -> bool {
    if(username == providedUser){
        return match providedPassword {
            None => false,
            Some(pw) => pw == password
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
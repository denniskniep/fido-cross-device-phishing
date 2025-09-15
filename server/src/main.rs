extern crate core;

mod handler_fido_auth;
mod handler_advertisement;

use std::fs;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use axum::{
    routing::{get, post},
     Router
};
use crate::handler_advertisement::Advertisement;
use tokio::sync::Mutex;
use crate::handler_fido_auth::FidoAuth;
use tower_http::cors::{CorsLayer, Any};
use axum_server::tls_rustls::RustlsConfig;
use tower::ServiceBuilder;
use tracing::{debug, info, warn, Level};
#[tokio::main]
pub async fn main() {
    let state =  AppState::default();

    let subscriber = tracing_subscriber::fmt().with_max_level(Level::DEBUG).finish();
    tracing::subscriber::set_global_default(subscriber);

    let cors_layer = CorsLayer::new()
        .allow_origin(Any)  // Open access to selected route
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/", get(root))
        .route("/advertisement", post(handler_advertisement::send))
        .route("/preauth", post(handler_fido_auth::pre_auth))
        .route("/auth", post(handler_fido_auth::auth))
        .layer(ServiceBuilder::new().layer(cors_layer))
        .with_state(state);

    //let listener = tokio::net::TcpListener::bind("0.0.0.0:3333").await.unwrap();
    //axum::serve(listener, app).await.unwrap();

    rustls::crypto::ring::default_provider()
        .install_default()
        .expect("should be able to install the default crypto provider");

    debug!("Using certs from {:?}.", fs::canonicalize(PathBuf::from("./crt/cert.pem")));
    let config = RustlsConfig::from_pem_file(
            PathBuf::from("./crt/cert.pem"),
            PathBuf::from("./crt/key.pem"),
           )
        .await
        .unwrap();

    // run https server
    let addr = SocketAddr::from(([0, 0, 0, 0], 4444));
    axum_server::bind_rustls(addr, config)
        .serve(app.into_make_service())
        .await
        .unwrap();

}

async fn root() -> &'static str {
    "Up!"
}

#[derive(Clone, Default)]
struct AppState {
    pub advertisements: Arc<Mutex<Vec<Advertisement>>>,
    pub fido_authentications: Arc<Mutex<Vec<FidoAuth>>>,
}
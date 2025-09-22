## CLI

```
Usage: server [OPTIONS] --username <USERNAME> --password <PASSWORD>

Options:
  -a, --address <ADDRESS>              [default: 127.0.0.1:4444]
  -u, --username <USERNAME>            [env: SERVER_USERNAME=]
  -p, --password <PASSWORD>            [env: SERVER_PASSWORD=]
      --tls-cert-path <TLS_CERT_PATH>  [default: ./crt/cert.pem]
      --tls-key-path <TLS_KEY_PATH>    [default: ./crt/key.pem]
  -d, --disable-tls                    
  -h, --help                           Print help
  -V, --version                        Print version
```   

## Test API
curl -v \
--header "Content-Type: application/json" \
--user beacon:123456 \
--request POST \
--data '{"beacon":"x0","address":"x1","uuid":"x2", "data":"XBx1t5mtvp/skYMbXaDsEtYvh+8="}' \
http://localhost:3333/advertisement

curl -v \
--header "Content-Type: application/json" \
--request POST \
http://localhost:3333/preauth

export ID=<id>

curl -v \
--header "Content-Type: application/json" \
--request POST \
--data "{\"id\":\"$ID\"}" \
http://localhost:3333/auth

## Links 
* [Rust TLS Example](https://github.com/tokio-rs/axum/tree/main/examples/tls-rustls/)
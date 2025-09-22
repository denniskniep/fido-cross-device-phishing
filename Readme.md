## Local Testing

### dns
Add following entries to `/etc/hosts`:
```
127.0.0.1       my-backend.com
127.0.0.1       my-original-site.com
127.0.0.1 	    my-phishing-site.com
127.0.0.1       login.my-phishing-site.com
127.0.0.1	    www.my-phishing-site.com
127.0.0.1       aadcdn.msftauth.my-phishing-site.com
127.0.0.1       aadcdn.msauth.my-phishing-site.com
```

### RootCA & TLS certs
Before you start you need to generate fresh certs!

Make sure that you have openssl installed

Execute `./cert-setup.sh`

Then import `evilginx/config/crt/ca.crt` as trusted root CA into your browser

### Start evilginx
Start dockerized evilginx
```
cd evilginx
docker build --tag evilginx . && docker run -p 443:443 -it evilginx
```

### Start server
Start server which is responsible to relay the webauthn requests via CTAP (through server "cable.ua5v.com", "cable.auth.com") to the authenticator

via cli
```
cd server
cargo run
```

or dockerized
```
cd server
docker build --tag fido-qr-server .
docker run -p 4444:4444 -e RUST_BACKTRACE=full fido-qr-server
```

### Start beacon
Start an application which is responsible to send all discovered BLE advertisements to the server
```
cd beacon
go run ./ start
```

### Open Phishing Url
* https://login.my-phishing-site.com/DZwkbKWF


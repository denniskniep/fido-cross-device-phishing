#!/bin/bash

mkdir -p evilginx/config/crt

# Create evilginx root ca
openssl req -subj "/CN=EvilRootCA" -newkey rsa:2048 -new -nodes -x509 -days 3650 -keyout evilginx/config/crt/private-pkcs8.key -out evilginx/config/crt/ca.crt
openssl pkey -in evilginx/config/crt/private-pkcs8.key -out evilginx/config/crt/private.key -traditional && rm evilginx/config/crt/private-pkcs8.key 

mkdir -p evilginx/src/crt

## Create npm https certs for dev 
openssl genrsa -out evilginx/src/crt/key.pem 2048
openssl req -new -sha256 -key evilginx/src/crt/key.pem -subj "/CN=my-original-site.com" -out evilginx/src/crt/cert.csr
openssl x509 -req \
-in evilginx/src/crt/cert.csr \
-CA evilginx/config/crt/ca.crt \
-CAkey evilginx/config/crt/private.key \
-CAcreateserial \
-out evilginx/src/crt/cert.pem \
-days 500 -sha256 \
-extfile <(printf '%s\n' \
'[v3_ca]' \
'basicConstraints = CA:FALSE' \
'keyUsage = digitalSignature, keyEncipherment' \
'subjectAltName = DNS:my-phishing-site.com,DNS:my-original-site.com') \
-extensions v3_ca

mkdir -p server/crt/

## Create https certs for server
openssl genrsa -out server/crt/key.pem 2048
openssl req -new -sha256 -key server/crt/key.pem -subj "/CN=my-backend.com" -out server/crt/cert.csr
openssl x509 -req \
-in server/crt/cert.csr \
-CA evilginx/config/crt/ca.crt \
-CAkey  evilginx/config//crt/private.key \
-CAcreateserial \
-out server/crt/cert.pem \
-days 500 -sha256 \
-extfile <(printf '%s\n' \
'[v3_ca]' \
'basicConstraints = CA:FALSE' \
'keyUsage = digitalSignature, keyEncipherment' \
'subjectAltName = DNS:my-backend.com, IP:127.0.0.1') \
-extensions v3_ca

mkdir -p beacon/crt/

## Copy CA to beacon
cp evilginx/config/crt/ca.crt beacon/crt/ca.crt


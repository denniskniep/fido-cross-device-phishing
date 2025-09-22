## CLI
```
Usage:
  beacon start [flags]

Flags:
  -h, --help                    help for start
  -i, --insecure-tls            Allow insecure server connections
  -p, --password string         Password for Server or use env var BEACON_PASSWORD
  -s, --server-address string   Sending the BLE advertisements to this address  (default "127.0.0.1:4444")
  -c, --tls-ca-path string      trusted ca pem file path (default "crt/ca.crt")
  -u, --username string         Username for Server or use env var BEACON_USERNAME

Global Flags:
  -v, --verbose   Verbose logging
```
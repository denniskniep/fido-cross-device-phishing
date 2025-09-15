package main

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"
	"tinygo.org/x/bluetooth"
)

var adapter = bluetooth.DefaultAdapter
var advertisements []*FidoAdvertisement
var stopped = false

func main() {
	must("enable BLE stack", adapter.Enable())

	// TODO: REMOVE this!
	http.DefaultTransport.(*http.Transport).TLSClientConfig = &tls.Config{InsecureSkipVerify: true}

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
			if IsFidoAdvertisement(serviceData.UUID.String()) {
				ad, err := NewFidoAdvertisement("Nr.1", device.Address.String(), serviceData.UUID.String(), serviceData.Data)
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

func addFidoAdvertisement(ad *FidoAdvertisement) {
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

func sendToServer(ad *FidoAdvertisement) error {
	jsonBody, err := json.Marshal(ad)
	bodyReader := bytes.NewReader(jsonBody)
	req, err := http.NewRequest(http.MethodPost, "https://localhost:4444/advertisement", bodyReader)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.SetBasicAuth("beacon", "123456")
	// This transport is what's causing unclosed connections.

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

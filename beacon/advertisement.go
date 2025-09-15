package main

import (
	"bytes"
	"encoding/hex"
	"errors"
	"strconv"
	"strings"
	"time"
)

var fidoUUIDs = [...]string{
	// FIDO
	//https://fidoalliance.org/specs/fido-v2.2-ps-20250714/fido-client-to-authenticator-protocol-v2.2-ps-20250714.html#sctn-hybrid
	"0000fff9-0000-1000-8000-00805f9b34fb",
	// GOOGLE
	// Deprecated, but may still be in use.
	"0000fde2-0000-1000-8000-00805f9b34fb",
}

type FidoAdvertisement struct {
	Beacon    string     `json:"beacon"`
	Address   string     `json:"address"`
	Uuid      string     `json:"uuid"`
	Data      []byte     `json:"data"`
	CountSeen int        `json:"-"`
	FirstSeen *time.Time `json:"-"`
	LastSeen  *time.Time `json:"-"`
}

func NewFidoAdvertisement(beacon string, address string, uuid string, data []byte) (*FidoAdvertisement, error) {
	//  have a 20-byte service data payload
	if len(data) != 20 {
		return nil, errors.New("FidoAdvertisements must have 20 bytes, but was" + strconv.Itoa(len(data)))
	}
	now := time.Now()
	return &FidoAdvertisement{Beacon: beacon, Address: address, Uuid: uuid, Data: data, CountSeen: 1, FirstSeen: &now, LastSeen: &now}, nil
}

func IsFidoAdvertisement(serviceUuid string) bool {
	for _, fidoUuid := range fidoUUIDs {
		if strings.EqualFold(fidoUuid, serviceUuid) {
			return true
		}
	}
	return false
}

func (a *FidoAdvertisement) Seen() {
	a.CountSeen++
	now := time.Now()
	a.LastSeen = &now
}

func (a *FidoAdvertisement) IsEqual(advertisement *FidoAdvertisement) bool {
	if advertisement.Address != a.Address {
		return false
	}

	if advertisement.Uuid != a.Uuid {
		return false
	}

	if !bytes.Equal(advertisement.Data, a.Data) {
		return false
	}
	return true
}

func (a *FidoAdvertisement) String() string {
	return "Beacon: " + a.Beacon + ", " +
		"Address: " + a.Address + ", " +
		"Uuid: " + a.Uuid + ", " +
		"Data: " + hex.EncodeToString(a.Data) + ", " +
		"CountSeen: " + strconv.Itoa(a.CountSeen) + ", " +
		"DurationSeen: " + a.LastSeen.Sub(*a.FirstSeen).String() + ", " +
		"FirstSeen: " + a.FirstSeen.String() + ", " +
		"LastSeen: " + a.LastSeen.String()
}

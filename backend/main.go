package main

import (
	"log"
	"net/http"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // allow all connections
	},
}

func handleWS(w http.ResponseWriter, r *http.Request) {
	log.Println("HTTP request received")

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Upgrade error:", err)
		return
	}

	log.Println("Client upgraded successfully")

	defer conn.Close()

	clients[conn] = true
	log.Println("Client added. Total clients:", len(clients))

	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			log.Println("Read error:", err)
			break
		}

		log.Println("Received:", string(msg))

		for client := range clients {
			client.WriteMessage(websocket.TextMessage, msg)
		}
	}
}

var clients = make(map[*websocket.Conn]bool)

func main() {
	http.HandleFunc("/ws", handleWS)

	log.Println("Server running on :8080")
	http.ListenAndServe(":8080", nil)
}
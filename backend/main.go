package main

import (
	"log"
	"net/http"
	"github.com/gorilla/websocket"
	"sketchbud-backend/realtime"
	"os"
)

var hub *realtime.Hub

//used to upgrade HTTP connections to WebSocket connections
var upgrader = websocket.Upgrader{
  CheckOrigin: func(r *http.Request) bool {
    origin := r.Header.Get("Origin")
    return origin == "https://sketchbud.vercel.app" ||
           origin == "http://localhost:5173" 
  },
}

func handleWS(w http.ResponseWriter, r *http.Request) {
	log.Println("HTTP request received")

	//upgrade 
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Upgrade error:", err)
		return
	}

	log.Println("Client upgraded successfully")

	roomID := r.URL.Query().Get("room")
	userID := r.URL.Query().Get("user")

	client := &realtime.Client{
		ID: userID,
		Conn: conn,
		Send: make(chan []byte),
		RoomName: roomID,
		Hub: hub,
	}

	log.Println("New client connected to room:", roomID)

	hub.Register <- client

	go client.ReadPump()
	go client.WritePump()
}

func main() {

	rooms := make(map[string]*realtime.Room) 
	rooms["room_1"] = &realtime.Room{
		Name: "room_1",
		Clients: make(map[*realtime.Client]struct{}),
	}
	rooms["room_2"] = &realtime.Room{
		Name: "room_2",
		Clients: make(map[*realtime.Client]struct{}), 
	}
	rooms["room_3"] = &realtime.Room{
		Name: "room_3",
		Clients: make(map[*realtime.Client]struct{}), 
	}

	hub = &realtime.Hub{
		Rooms: rooms,  
		Register: make(chan *realtime.Client),
		Unregister: make(chan *realtime.Client),
		Broadcast: make(chan realtime.OperationPacket),
	}

	go hub.Run()

	http.HandleFunc("/ws", handleWS)
	http.HandleFunc("/rooms", hub.RoomCountsHandler)
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Println("Server running on :" + port)
	http.ListenAndServe(":"+port, nil)
}
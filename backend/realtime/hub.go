package realtime 

import (
	"log"
)

type Hub struct {
    Rooms map[string]*Room
    Register chan *Client
    Unregister chan *Client
    Broadcast chan Message
}

type Room struct {
    Name string
    Clients map[*Client]struct{}
}

func (h *Hub) Run() {
    for {
        select {
        case client := <-h.Register:
            room := h.Rooms[client.RoomName]
            room.Clients[client] = struct{}{}
        case client := <-h.Unregister:
            room := h.Rooms[client.RoomName]
            delete(room.Clients, client)
        }
       
        for roomName, room := range h.Rooms {
            log.Printf("Room: %s", roomName)

            for client := range room.Clients {
                log.Printf("  └─ client: %s", client.ID)
            }
        }
    }
}
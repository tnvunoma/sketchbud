package realtime 

import (
	"log"
)

type Hub struct {
    Rooms map[string]*Room
    Register chan *Client
    Unregister chan *Client
    Broadcast chan OperationPacket
}

type Room struct {
    Name string
    Clients map[*Client]struct{}
    OpLog [][]byte
}

type OperationPacket struct {
    Msg []byte
    Room string
}

func (h *Hub) Run() {
    for {
        select {
            case client := <-h.Register:
                room := h.Rooms[client.RoomName]
                room.Clients[client] = struct{}{}

                for _, op := range room.OpLog {
                    client.Send <- op
                }
            case client := <-h.Unregister:
                room := h.Rooms[client.RoomName]
                delete(room.Clients, client)
            case msg := <-h.Broadcast:
                room := h.Rooms[msg.Room]
                for client := range room.Clients {
                    select {
                        case client.Send <- msg.Msg:
                    }
                }

                room.OpLog = append(room.OpLog, msg.Msg) //store 
        }
       

        //logging rooms
        for roomName, room := range h.Rooms {
            log.Printf("Room: %s", roomName)

            for client := range room.Clients {
                log.Printf("  └─ client: %s", client.ID)
            }
        }
    }
}
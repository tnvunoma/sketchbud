package realtime 

import (
	"log"
	"github.com/gorilla/websocket"
	"sketchbud-backend/packetlib"
	"encoding/json"
)

type Client struct {
	ID string
    Conn *websocket.Conn
    Send chan []byte
    RoomName string
	Hub      *Hub
}

func (c *Client) ReadPump() {
    for {
		_, msg, err := c.Conn.ReadMessage()
		if err != nil {
			log.Println("Read error:", err)
			c.Hub.Unregister <- c
			break
		}

		var base packetlib.OperationPacket

		if err := json.Unmarshal(msg, &base); err != nil {
			log.Println("Bad message:", err)
			continue
		}

		log.Println("Received type:", base.Type)

		switch base.Type {
			case "stroke", "fill", "clear":  //only checking type, perhaps should also check message format
				c.Hub.Broadcast <- Message{
					Msg: msg,
					Room: c.RoomName,
				}
			default:
				log.Println("Unknown type:", base.Type)
		}
	}
}

func (c *Client) WritePump() {

	for {
		select {
			case msg, ok := <-c.Send:
				if !ok { //chan closed so close websocket
					c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
					return
				}

				err := c.Conn.WriteMessage(websocket.TextMessage, msg)
				if err != nil {
					log.Println("Write error:", err)
					return
				}
		}
	}
}
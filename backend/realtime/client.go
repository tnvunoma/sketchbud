package realtime 

import (
	"log"
	"github.com/gorilla/websocket"
)

type Client struct {
	ID string
    Conn *websocket.Conn
    Send chan []byte
    RoomName string
	Hub      *Hub
}

func (client *Client) ReadPump() {
    for {
		_, msg, err := client.Conn.ReadMessage()
		if err != nil {
			log.Println("Read error:", err)
			client.Hub.Unregister <- client
			break
		}
		log.Println("What was read:", msg)
    }
}

func (c *Client) WritePump() {

}
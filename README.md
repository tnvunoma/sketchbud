# Introduction 
For our final project, we set out to create a real-time, multi-user online drawing website, where users can draw on shared canvases with other users. Our drawing application supports 3 lobbies, each capable of supporting multiple users. 

# Design/Implementation
We built a drawing application for users to draw with one another in real-time. Upon opening the application, the user is greeted with the home page where they can select a lobby to join. Each lobby contains one canvas where users can draw on using their mouse. Users can go back to the home page to switch between lobbies. 

### Frontend: 
We used React and Typescript to code the frontend of our application. The frontend handles rendering the UI and user interaction with the UI. On the canvas, a user can draw, erase, and fill. The brush size and opacity can be varied and the brush’s color can be changed using the pre-defined color palette or the color picker. The user can also undo and redo their own canvas actions, as well as clear the entire canvas. 

We use a two layer canvas system to ensure smooth rendering. Each canvas has a committed layer and a live preview layer. When a drawing operation is completed (i.e. when the user’s mouse clicks off the canvas), the operation is then committed to the operation log. This operation log is used to render the canvas for users. The live preview layer is used to render what the current user is currently drawing. This canvas architecture prevents the need to redraw the canvas for all users at every moment, which can introduce bandwidth issues when there are many users performing many operations on a single canvas.     

### Backend: 
We used Go to code the backend of our application. The backend handles broadcasting canvas information between users in a shared lobby. Our application supports 3 lobbies/rooms which each contain one canvas. 

We define a Hub struct to manage the lobbies:

```go
type Hub struct {
   Rooms map[string]*Room
   Register chan *Client
   Unregister chan *Client
   Broadcast chan OperationPacket
}
```

Rooms is a map of the lobbies/rooms. A Room struct is defined as such: 

```go
type Room struct {
   Name string
   Clients map[*Client]struct{}
   OpLog [][]byte
}
```

Each room keeps track of its current users and the current state of their canvas. The OpLog contains the sequence of drawing operations that have been performed on the room’s canvas. 

Going back to the Hub struct, a register chan is used to notify the hub when a user joins a lobby. Upon connection, the user is added to that room’s client list and the room’s operation log is sent to the user's frontend, which then applies all the operations so that the user’s canvas shows its most recent state. The unregister chan is used to notify the hub when a user leaves a lobby. Upon leaving, the user is removed from that room’s client list. 

The broadcast chan is used when the client reads in a message (a drawing operation). The hub then propagates this message to all clients who are in the same room as the client who received the message. More about this down below.

We define a Client struct as such: 
```go
type Client struct {
   ID string
   Conn *websocket.Conn
   Send chan []byte
   RoomName string
   Hub      *Hub
}
```
ID contains the client’s id that is created in the frontend using crypto.randomUUID() and which is stored in local storage to ensure each client retains their same user id between browser refreshes and page changes. The user id is entered as a query parameter in the websocket url that is created by the frontend. 

Conn holds the client’s websocket connection. We use gorilla/websocket to upgrade HTTP connections to WebSocket connections. 

Send chan receives bytes from the hub, more on this below. RoomName contains the name of the room in which the client is in. Hub stores a reference to the one hub that is created when the program first starts. 

Each client has two goroutines running, one calling the function ReadPump and the other calling the function WritePump. In ReadPump, the client’s connection is constantly reading messages. These messages come from the client’s frontend and are the client’s drawing operations made to their canvas. These messages are received as bytes and are briefly packed into operation packets: 
```go
type OperationPacket struct {
   Msg []byte
   Room string
}
```
These messages are sent to the hub, who broadcasts them to the other users in the same lobby. 

In WritePump, the client’s send chan receives operation packets from the Hub and sends them over the websocket to the frontend. These messages contain the drawing operations made to the canvas by other users. Upon receiving these messages, the frontend will be able to update the client’s canvas to its most updated state. 

### Canvas Shared State Functionality: 
When one user makes a change to the canvas, all users who are on the same canvas will see that change. This is accomplished by using an operation log and websockets. A websocket is created whenever a user joins a lobby, and this websocket is used to disseminate information about the canvas state appropriately. When a user makes a change to their canvas, the action made is saved to the operation log and sent through the websocket to the backend. The frontend replays the operation log whenever it is updated ensuring the canvas is always up to date.   

## Discussions/Results
A full walk through of our application can be viewed in our video: 

Through this project, we learned about websockets and how messages are passed using websockets. We also learned about how to design an application that involves shared state management between users. 
 
The major challenge we faced was figuring out how to broadcast the canvas changes made from one user to the other users in the same lobby. We first tried parsing the operations sent by the frontend into specific operation structs for the backend, but we realized that the backend should only be concerned with broadcasting the information, not interpreting it. Therefore, we created an OperationPacket that simply stores the bytes of the operation received from the frontend and the name of the room which the bytes came from. 

#### AI Usage:
AI was used to set up the frontend UI. Specifically, it was used to write all the css files and to write the code for the canvas and for the drawing operations. AI was used to set up the file architecture for the backend. AI recommended creating a go file for hub and client. AI was also used to help with figuring out how to pass user id and room id from the frontend to the backend.

AI is very good with enough context and instruction. When AI was used to write the frontend, we did it incrementally so we could review the changes at each step and ensure we understood what we were adding to our code. Because our application renders in real time and is based on user interface changes, it was very easy to tell if our project was working or not. 

## Conclusions/Future Work
Overall, we were able to learn how to deal with state management for multiple users across a network and how to design a scalable system for multiple users. This project was quite fun and it felt rewarding to be able to create such an application with our networking knowledge. 

In the future, we would like to add more complex canvas operations like having layers or more art tools. We would also like to add lobby music. We would also look into having users being able to create their own lobbies and being able to set them to being public or private. 

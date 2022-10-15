# Hachi NIO protocol lib for NodeJS

Hachi Protocol is a lightwight network I/O socket communication format to transfer data between applications based on my old project [irineu/eight-protocol](https://github.com/irineu/eight-protocol). 

<img src="http://irineuantunes.com/hachi-protocol.svg" height="100" valign="middle"> for <img src="http://irineuantunes.com/logo-node-js-512.png" height="80" valign="bottom">

## Objective
When you test a simple socket communication, in the more of times everything works fine, but when your project grow up, after publish and test with remote and bad connections, you will get some problems with truncated messages or messages with extra data (part of the next message). It is normal. You'll need create a protocol to handle this situation, maybe implement a header or a terminator (bad ideia), maybe you are already frustated with that notice.

The Hachi Protocol is an implementation plug-and-play of a transparent protocol for handle those situations for you, and the most important: it does not change your code too much. The protocol itself is encapsulated in this library and you can do your business stuff without take care about the bits (like the HTTP protocol).

The message transfered is distributed in two sections:
##### Header
A Key/Value object to identify the message (parameter: transaction, id, token, type, etc...), you can set any object.
##### Body
Binary Data, you can pass anything here

## Quick Start

##### Server
```javascript
import hachiNIO from "hachi-nio";

let server = new hachiNIO.server(7890);

server.on('server_listening', () => {
	console.log("Server is up! Now waiting for connections");
});

server.on('client_connected', (socketClient) => {
	console.log("NEW CLIENT CONNECTED! \t id:"+socketClient.id+" origin:"+socketClient.address().address);
});

server.on('client_close', (socketClient) => {
	console.log("CLIENT DISCONNECTED! \t id:"+socketClient.id);
});

server.on("data", (socketClient, header, dataBuffer) => {
	console.log("MESSAGE RECEIVED! \t id:"+socketClient.id+" message:"+dataBuffer.toString());
});
```

##### Client
```javascript
import hachiNIO  from "../../index.js";

var client = new hachiNIO.client("0.0.0.0",7890);

client.on("client_connected", function(socket){
	console.log("Connected on the server");
	//Send message
	hachiNIO.send(socket, {transaction : "GREETINGS"}, "Hello World!");
})
```

## API

`hachiNIO.send(socket, header, buffer, [callback]);`
Send a message for the given socket.
* Socket - The nodejs socket from the new connection callback
* Header - Key/Value object, it will be converted internally to a JSON String
* Buffer - Your data, must be a buffer or String
* Callback (optional) - A callback function with and error parameter if it have

### Server
`new hachiNIO.server(port, [tlsOptions]);`
Instantiate a new server and try to start listen imediatly
* port - must be an integer, it will be the respective TCP port to listen
* tlsOptions (optional) - if set, must be an object ({key: "path", cert:"path"}) to establish a TLS connection
 
##### Events

| Event name       | Description                  |
|------------------|---------------------------------------------------------------------------------------------------------------|
| client_connected | callback(clientSocket : Socket) - When a new client connection is established on the server                   |
| client_close     | callback(clientSocket : Socket, hadError : Boolean)When a client disconnect from the server                   |
| client_end       | callback(clientSocket : Socket) - When a client connection ends                                               |
| client_timeout   | callback(clientSocket : Socket) - When a client timeout                                                       |
| client_error     | callback(clientSocket : Socket, error : Object) - When client socket gives an error                           |
| data             | callback(clientSocket : Socket, header : Object , dataBuffer : Buffer) - When receive a message from a client |
| server_error     | callback(error : Object) - When the server gives an error                                                     |
| server_listening | callback() - When the server start listening                                                                  |

### Client

`new hachiNIO.client(address, port, [timeout], [tlsOptions])`

Instantiate a new client and try connect imediatly

* Address - Must me and string, should be the remote ip address
* port - must be an integer, it will be the respective TCP port to listen
* timeout (optional) - must be an integer, will set the socket timeout (see more at https://nodejs.org/api/net.html#net_socket_settimeout_timeout_callback)
* tlsOptions (optional) - If set, must be an empty object just to start the socket as a TLS connection

##### Events

| Event name       | Description                                                                                                   |
|------------------|---------------------------------------------------------------------------------------------------------------|
| client_connected | callback(clientSocket : Socket) - When connection is established on the server                                |
| client_close     | callback(clientSocket : Socket, hadError : Boolean) When disconnect from the server                           |
| client_end       | callback(clientSocket : Socket) - When connection ends                                                        |
| client_timeout   | callback(clientSocket : Socket) - When connection timedout                                                    |
| client_error     | callback(clientSocket : Socket, error : Object) - When client socket gives an error                           |
| data             | callback(clientSocket : Socket, header : Object , dataBuffer : Buffer) - When receive a message from a Server |





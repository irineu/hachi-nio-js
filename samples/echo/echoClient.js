////////////////////////////////////////
//IT WILL NOT WORK WITH TELNET CLIENT!!!
////////////////////////////////////////

import protocol  from "../../index.js";

var client = new protocol.client("0.0.0.0",7890);

client.on("client_connected", (socket) => {
	console.log("Connected on the server");
	protocol.send(socket, {transaction : "GREETINGS"}, "Hello World!");
});
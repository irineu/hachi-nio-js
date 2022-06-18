////////////////////////////////////////
//IT WILL NOT WORK WITH TELNET CLIENT!!!
////////////////////////////////////////

import hachiNIO  from "../../index.js";

var client = new hachiNIO.client("0.0.0.0",7890);

client.on("client_connected", (socket) => {
	console.log("Connected on the server");
	hachiNIO.send(socket, {transaction : "GREETINGS"}, "Hello World!");
});

client.on("data", function(socket, header, dataBuffer){
    console.log(dataBuffer.toString())
});
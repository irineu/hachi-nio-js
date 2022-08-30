////////////////////////////////////////
//IT WILL NOT WORK WITH TELNET CLIENT!!!
////////////////////////////////////////

import hachiNIO  from "../../index.js";

var client = new hachiNIO.client("0.0.0.0",7890, null, {});

client.on("data", function(socket, header, dataBuffer){
    console.log(dataBuffer.toString())
});

client.on("client_end", function(socket){
    console.log("end")
});

client.on("client_close", function(socket, hadError){
    console.log("close", hadError)
});

client.on("client_error", function(socket, error){
    console.log("error", error)
});

client.on("client_connected", (socket) => {
	console.log("Connected on the server");
	hachiNIO.send(socket, {transaction : "GREETINGS"}, "Hello World!");
});

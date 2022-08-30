////////////////////////////////////////
//IT WILL NOT WORK WITH TELNET CLIENT!!!
////////////////////////////////////////

import hachiNIO  from "../../index.js";

let server = new hachiNIO.server(7890, {
    key: '/Users/t736609/Desktop/projects/CPP/FraudDetector/relay-mtls/crt-03/server-key.pem',
    cert: '/Users/t736609/Desktop/projects/CPP/FraudDetector/relay-mtls/crt-03/server-crt.pem',
});

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
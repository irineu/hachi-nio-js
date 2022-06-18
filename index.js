var net = require('net');
var events = require('events');
var uuid = require("node-uuid");
var util = require('util');
/**
* Server Impl
**/

var ProtocolServer = function(port,debug){
	var instance = this;
	instance.port = port;
	instance.debug = debug || false;
	this.setup();
}

util.inherits(ProtocolServer, events.EventEmitter);

ProtocolServer.prototype.setup = function(){
	var instance = this;
	instance.server = net.createServer(function(socket){

		socket.id = uuid.v4();
		socket.chunck = {
			messageSize : 0,
			headerSize:0,
			buffer: new Buffer(0),
			bufferStack: new Buffer(0)
		};

		instance.emit("client_connected",socket);

		socket.on("close",function(had_error){
			instance.emit("client_close",this,had_error);
		});

		socket.on("end", function(){
			instance.emit("client_end",this);
		});

		socket.on('data', function(data){

			if(instance.debug) console.log("EP","IN",socket.remoteAddress +":"+socket.remotePort,data.length);

			module.exports.recieve(this,data,function(socket,headerBuffer,dataBuffer){
				try{
					var header = JSON.parse(headerBuffer);
					if(header.transaction == "HEARTBEAT"){
						//ignore
					}else{
						instance.emit("data",socket,header,dataBuffer);
					}
				}catch(e){
					console.error(e.message);
					console.error(e.stack);
				}
			});
        });

        socket.on("timeout", function(){
        	instance.emit("client_timeout",this);
        });

        socket.on("error", function(err){
        	instance.emit("client_error",this,err);
        });
	});

	instance.server.on('error',function(err){
		instance.emit("server_error",err);
	});

	instance.server.on('listening',function(){
		instance.emit("server_listening");
	});

	instance.server.listen(instance.port, '0.0.0.0');
}

/**
* Client Impl
**/

var ProtocolClient = function(ip, port,timeout,debug){
	var instance = this;
	instance.ip = ip;
	instance.port = port;
	instance.debug = debug || false;
	instance.timeout = timeout;
	this.setup();
}

util.inherits(ProtocolClient, events.EventEmitter);

ProtocolClient.prototype.reconnect = function(){
	var instance = this;
	this.setup();
	//instance.socket.connect(instance.port,instance.ip);
}

ProtocolClient.prototype.setup = function(){
	var instance = this;
	instance.socket = new net.Socket();

	instance.socket.connect(instance.port,instance.ip);

	instance.socket.on('connect', function(){
		this.chunck = {
			messageSize : 0,
			headerSize:0,
			buffer: new Buffer(0),
			bufferStack: new Buffer(0)
		};

		this.setTimeout(10000,function(){

		});
		instance.emit("client_connected",this);
	});

	instance.socket.on('data', function(data){

		if(instance.debug) console.log("EP","IN",instance.socket.remoteAddress +":"+instance.socket.remotePort,data.length);

		module.exports.recieve(this,data,function(socket,headerBuffer,dataBuffer){
			var header = JSON.parse(headerBuffer);
			if(header.transaction == "HEARTBEAT"){
				//ignore
			}else{
				instance.emit("data",socket,header,dataBuffer);
			}

		});
	});

	instance.socket.on('end', function(){
		instance.emit("client_end",this);
	});

	instance.socket.on('close', function(had_error){
		instance.emit("client_close",this,had_error);
	});

	instance.socket.on('timeout', function(){
		module.exports.send(this, {transaction:"HEARTBEAT", type: "REQUEST",id:module.exports.generateId("HB")},"");
		instance.emit("client_timeout",this);
	});

	instance.socket.on('error', function(err){
		instance.emit("client_error",this,err);
	});

	if(instance.timeout)
		instance.socket.setTimeout(instance.timeout);
};

module.exports = {
	client : ProtocolClient,
	server : ProtocolServer,
    send: function(clientSocket, header, data, callback) {

    	if(clientSocket.destroyed){
    		return console.error("EP","OUT","SOCKET IS DESTROYED!");
    	}

        var bufferHeader = new Buffer(JSON.stringify(header), "utf8");
        var bufferData = new Buffer(data, "utf8");
        var consolidatedBuffer = new Buffer(8 + bufferHeader.length + bufferData.length);

        consolidatedBuffer.writeInt32LE(bufferHeader.length + bufferData.length + 8, 0);
        consolidatedBuffer.writeInt32LE(bufferHeader.length, 4);
        bufferHeader.copy(consolidatedBuffer, 8);
        bufferData.copy(consolidatedBuffer, bufferHeader.length + 8);

        if(this.debug) console.log("EP","OUT",clientSocket.remoteAddress +":"+clientSocket.remotePort,consolidatedBuffer.length);

        clientSocket.write(consolidatedBuffer, function(err) {
            if (err && callback) {
                callback(err);
            }else if(callback){
            	callback();
            }
        });
    },
    generateId : function(label){
    	return label+"-"+new Date().getTime();
    },
    recieve: function(clientSocket, data,callback) {
        clientSocket.chunck.bufferStack = Buffer.concat([clientSocket.chunck.bufferStack, data]);

        var reCheck = false;
        do {
            reCheck = false;
            if (clientSocket.chunck.messageSize == 0 && clientSocket.chunck.bufferStack.length >= 4) {
                clientSocket.chunck.messageSize = clientSocket.chunck.bufferStack.readInt32LE(0);
            }

            if(clientSocket.chunck.bufferStack.length >= 8){
            	clientSocket.chunck.headerSize = clientSocket.chunck.bufferStack.readInt32LE(4);
            }

            if (clientSocket.chunck.messageSize != 0 && clientSocket.chunck.bufferStack.length >= clientSocket.chunck.messageSize) {

                var bufferHeader = clientSocket.chunck.bufferStack.slice(8, clientSocket.chunck.headerSize + 8);
                var bufferData = clientSocket.chunck.bufferStack.slice(clientSocket.chunck.headerSize + 8, clientSocket.chunck.messageSize);

                clientSocket.chunck.messageSize = 0;
                clientSocket.chunck.headerSize = 0;

                if(this.debug) console.log("EP","RECOGNIZED-HEADER",bufferHeader.length);
                if(this.debug) console.log("EP","RECOGNIZED-DATA",bufferData.length);

                clientSocket.chunck.bufferStack = clientSocket.chunck.bufferStack.slice(bufferHeader.length + bufferData.length + 8);

                callback(clientSocket, bufferHeader, bufferData);
                reCheck = clientSocket.chunck.bufferStack.length > 0;
            }
        } while (reCheck);
    }
}
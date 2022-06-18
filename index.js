import net from 'net'
import { EventEmitter } from 'events'
import uuid from 'node-uuid'
import util from 'util'

/**
* Server Impl
**/

class ProtocolServer extends EventEmitter{
    constructor(port, debug){
        super();
        this.port = port;
        this.debug = debug || false;

        this.setup();
    }

    setup(){
	    this.server = net.createServer((socket) => {

            socket.id = uuid.v4();
            socket.chunck = {
                messageSize : 0,
                headerSize:0,
                buffer: new Buffer.alloc(0),
                bufferStack: new Buffer.alloc(0)
            };

            const instance = this;

            instance.emit("client_connected",socket);

            socket.on("close",function(had_error){
                instance.emit("client_close",this,had_error);
            });

            socket.on("end", function(){
                instance.emit("client_end",this);
            });

            socket.on('data', function(data){

                if(instance.debug) console.log("HACHI-NIO","IN",socket.remoteAddress +":"+socket.remotePort,data.length);

                mod.recieve(this,data,function(socket,headerBuffer,dataBuffer){
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

        this.server.on('error',(err) => {
            this.emit("server_error",err);
        });
    
        this.server.on('listening',() => {
            this.emit("server_listening");
        });
    
        this.server.listen(this.port, '0.0.0.0');
    }
}

/**
* Client Impl
**/

class ProtocolClient extends EventEmitter{
    constructor(ip, port,timeout,debug){
        super();
        this.ip = ip;
        this.port = port;
        this.debug = debug || false;
        this.timeout = timeout;
        this.setup();
    }

    reconnect(){
        this.setup();
    }

    setup(){

        this.socket = new net.Socket();

        this.socket.connect(this.port,this.ip);

        this.socket.on('connect', () => {
            this.chunck = {
                messageSize : 0,
                headerSize:0,
                buffer: new Buffer.alloc(0),
                bufferStack: new Buffer.alloc(0)
            };

            this.emit("client_connected",this.socket);
        });

        this.socket.on('data', (data) => {

            if(this.debug) console.log("HACHI-NIO","IN", this.socket.remoteAddress +":"+this.socket.remotePort,data.length);

            mod.recieve(this, data, (socket,headerBuffer,dataBuffer)=> {
                let header = JSON.parse(headerBuffer);
                if(header.transaction == "HEARTBEAT"){
                    //ignore
                }else{
                    this.emit("data", socket, header, dataBuffer);
                }

            });
        });

        this.socket.on('end', () => {
            this.emit("client_end",this.socket);
        });

        this.socket.on('close', (had_error) => {
            this.emit("client_close",this.socket,had_error);
        });

        this.socket.on('timeout', () => {
            mod.send(this, { transaction:"HEARTBEAT", type: "REQUEST",id: mod.generateId("HB")},"");
            this.emit("client_timeout",this.socket);
        });

        this.socket.on('error', (err) => {
            this.emit("client_error",this.socket,err);
        });

        if(this.timeout){
            this.socket.setTimeout(this.timeout);
        }
            
    }
}

const mod = {
	client : ProtocolClient,
	server : ProtocolServer,
    send: function(clientSocket, header, data, callback) {

    	if(clientSocket.destroyed){
    		return console.error("EP","OUT","SOCKET IS DESTROYED!");
    	}

        var bufferHeader = new Buffer.from(JSON.stringify(header), "utf8");
        var bufferData = new Buffer.from(data, "utf8");
        var consolidatedBuffer = new Buffer.alloc(8 + bufferHeader.length + bufferData.length);

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

export default mod;
import net from 'net'
import tls from 'tls'
import fs from 'fs'
import { EventEmitter } from 'events'
import uuid from 'node-uuid'
import util from 'util'

const PROTOCOL_PREFIX = 8
const PREFIX_BUFFER = new Buffer.from("HNIO");
/**
* Server Impl
**/

class ProtocolServer extends EventEmitter{
    constructor(port, tlsOptions){
        super();
        this.port = port;
        this.secure = tlsOptions != null;
        
        if(this.secure){
            this.tlsOptions = {
                key: fs.readFileSync(tlsOptions.key),
                cert: fs.readFileSync(tlsOptions.cert)
            }
        }

        this.setup();
    }

    setup(){

	    let cb = (socket) => {

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

                if(process.env.HACHI_NIO_DEBUG) console.log("HACHI-NIO","IN",socket.remoteAddress +":"+socket.remotePort,data.length);

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
        };

        if(this.secure){
            this.server = tls.createServer(this.tlsOptions, cb);
        }else{
            this.server = net.createServer(cb);
        }

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

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';


class ProtocolClient extends EventEmitter{
    constructor(ip, port,timeout, tlsOptions){
        super();
        this.ip = ip;
        this.port = port;
        this.timeout = timeout;
        this.tlsOptions = tlsOptions;
        this.setup();
    }

    reconnect(){
        this.setup();
    }

    setup(){

        if(this.tlsOptions){
            this.socket = tls.connect({
                host: this.host,
                port: this.port
            })
        }else{
            this.socket =  new net.Socket();
            this.socket.connect(this.port,this.ip);
        }

    
        this.socket.on('connect', () => {
            this.socket.chunck = {
                messageSize : 0,
                headerSize:0,
                buffer: new Buffer.alloc(0),
                bufferStack: new Buffer.alloc(0)
            };

            this.emit("client_connected",this.socket);
        });

        this.socket.on('data', (data) => {
            if(process.env.HACHI_NIO_DEBUG) console.log("HACHI-NIO","IN", this.socket.remoteAddress +":"+this.socket.remotePort,data.length);
            mod.recieve(this.socket, data, (socket,headerBuffer,dataBuffer)=> {
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
        var consolidatedBuffer = new Buffer.alloc(PROTOCOL_PREFIX + PREFIX_BUFFER.length + bufferHeader.length + bufferData.length);

        PREFIX_BUFFER.copy(consolidatedBuffer, 0);
        consolidatedBuffer.writeInt32LE(bufferHeader.length + bufferData.length + PROTOCOL_PREFIX + PREFIX_BUFFER.length, PREFIX_BUFFER.length);
        consolidatedBuffer.writeInt32LE(bufferHeader.length, PREFIX_BUFFER.length + 4);
        bufferHeader.copy(consolidatedBuffer, PROTOCOL_PREFIX + PREFIX_BUFFER.length);
        bufferData.copy(consolidatedBuffer, bufferHeader.length + PROTOCOL_PREFIX + PREFIX_BUFFER.length);

        if(process.env.HACHI_NIO_DEBUG){
            console.log("EP","OUT",clientSocket.remoteAddress +":"+clientSocket.remotePort,consolidatedBuffer.length);
        }
            
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

            if(clientSocket.chunck.messageSize == 0 && clientSocket.chunck.bufferStack.length >= PREFIX_BUFFER.length){
                let inPrefixBuffer = clientSocket.chunck.bufferStack.slice(0, PREFIX_BUFFER.length);
                if(inPrefixBuffer.compare(PREFIX_BUFFER) != 0){
                    console.log("Protocol problem.");
                    clientSocket.write("Protocol problem.\n", function(err) {
                        clientSocket.end();
                    });
                }
            }

            if (clientSocket.chunck.messageSize == 0 && clientSocket.chunck.bufferStack.length >= PREFIX_BUFFER.length + 4) {
                clientSocket.chunck.messageSize = clientSocket.chunck.bufferStack.readInt32LE(PREFIX_BUFFER.length);
            }

            if(clientSocket.chunck.bufferStack.length >= PROTOCOL_PREFIX + PREFIX_BUFFER.length){
            	clientSocket.chunck.headerSize = clientSocket.chunck.bufferStack.readInt32LE(PREFIX_BUFFER.length + 4);
            }

            if (clientSocket.chunck.messageSize != 0 && clientSocket.chunck.bufferStack.length >= clientSocket.chunck.messageSize) {

                var bufferHeader = clientSocket.chunck.bufferStack.slice(PROTOCOL_PREFIX + PREFIX_BUFFER.length, clientSocket.chunck.headerSize + PROTOCOL_PREFIX + PREFIX_BUFFER.length);
                var bufferData = clientSocket.chunck.bufferStack.slice(clientSocket.chunck.headerSize + PROTOCOL_PREFIX + PREFIX_BUFFER.length, clientSocket.chunck.messageSize);

                clientSocket.chunck.messageSize = 0;
                clientSocket.chunck.headerSize = 0;

                if(process.env.HACHI_NIO_DEBUG) {
                    console.log("EP","RECOGNIZED-HEADER",bufferHeader.length);
                    console.log("EP","RECOGNIZED-DATA",bufferData.length);
                }

                clientSocket.chunck.bufferStack = clientSocket.chunck.bufferStack.slice(bufferHeader.length + bufferData.length + PROTOCOL_PREFIX + PREFIX_BUFFER.length);

                callback(clientSocket, bufferHeader, bufferData);
                reCheck = clientSocket.chunck.bufferStack.length > 0;
            }
        } while (reCheck);
    }
}

export default mod;
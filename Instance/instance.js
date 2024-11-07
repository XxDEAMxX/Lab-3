const express = require('express');
const dotenv = require('dotenv');
const WebSocket = require('ws');

const app = express();
const port = process.env.INSTANCE_PORT || 3000;
dotenv.config();

let logicalTime = new Date();
let logs = []; 
const clients = new Set(); 

function getFormattedTime() {
    const hours = String(logicalTime.getHours()).padStart(2, '0');
    const minutes = String(logicalTime.getMinutes()).padStart(2, '0');
    const seconds = String(logicalTime.getSeconds()).padStart(2, '0');

    return `${hours}:${minutes}:${seconds}`;
}

function logMessage(message) {
    const timestampedMessage = `[${new Date().toISOString()}] ${message}`;
    console.log(timestampedMessage); 
    logs.push(timestampedMessage); 
}

function sendTimeToClients() {
    const timeMessage = JSON.stringify({ time: getFormattedTime() });
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(timeMessage);
        }
    });
}

setInterval(() => {
    logicalTime.setSeconds(logicalTime.getSeconds() + 1);
    sendTimeToClients();
}, 1000);

app.use((req, res, next) => {
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    logMessage(`${req.method} ${url}`);
    next();
});

function applyRandomOffset() {
    const offset = Math.floor(Math.random() * 121) - 60; 
    logicalTime.setSeconds(logicalTime.getSeconds() + offset);
    logMessage(`Applied offset: ${offset} seconds`);
}

app.get('/logs', (req, res) => {
    res.json({ logs });
});

app.get('/time', (req, res) => {
    res.json({ time: logicalTime });
});

app.post('/sync', express.json(), (req, res) => {
    const { offset } = req.body; 

    if (typeof offset === 'number') {
        logicalTime.setSeconds(logicalTime.getSeconds() + offset);
        logMessage(`Synchronized logical time with offset: ${offset} seconds`);
        res.status(200).json({ message: 'Logical time synchronized successfully', newTime: getFormattedTime() });
    } else {
        res.status(400).json({ error: 'Invalid offset value. It must be a number.' });
    }
});

async function register()  {
    try {
        const response = await fetch('http://localhost:4000/register', 
            { 
                method: 'POST', 
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    host: 'localhost',
                    port: port
                })
        });
        if (response.ok) {
            const result = await response.text();
            console.log(result);
        } else {
            console.log("Error al registrar la instancia");
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

const server = app.listen(port, async () => {
    logMessage(`Instance running at ${port}`);
    await register();
    applyRandomOffset();
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    logMessage('New client connected');
    clients.add(ws);

    ws.send(JSON.stringify({ time: getFormattedTime() }));

    ws.on('close', () => {
        logMessage('Client disconnected');
        clients.delete(ws); 
    });
});

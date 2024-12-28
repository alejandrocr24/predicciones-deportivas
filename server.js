const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors'); // Importar cors
const fetch = require('node-fetch'); // Importar fetch para solicitudes HTTP
const app = express();
const PORT = 3000;

// Activar CORS para todas las solicitudes
app.use(cors());

// Conectar a la base de datos SQLite
const db = new sqlite3.Database('./sports.db', (err) => {
    if (err) {
        console.error('Error al conectar a la base de datos:', err.message);
    } else {
        console.log('Conectado a la base de datos SQLite.');
    }
});

// Crear tabla de juegos
db.run(`
    CREATE TABLE IF NOT EXISTS games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        teamA TEXT,
        teamB TEXT,
        date TEXT,
        analysis TEXT
    )
`);

// Endpoint básico para probar el servidor
app.get('/', (req, res) => {
    res.send('Servidor funcionando correctamente.');
});

// Endpoint para obtener próximos juegos y almacenarlos en la base de datos
app.get('/fetch-games', async (req, res) => {
    try {
        const url = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
        const mockData = {
            events: [
                {
                    competitions: [
                        {
                            competitors: [
                                { team: { displayName: 'Equipo A' } },
                                { team: { displayName: 'Equipo B' } }
                            ]
                        }
                    ],
                    date: '2024-12-28T01:00:00Z'
                }
            ]
        };
        
// Usa mockData en lugar de data para pruebas simuladas
const events = mockData.events;

        // Limpiar tabla de juegos antes de agregar nuevos datos
        db.run('DELETE FROM games', (err) => {
            if (err) {
                console.error('Error al limpiar la tabla de juegos:', err.message);
                return res.status(500).json({ error: 'Error al limpiar la base de datos.' });
            }
        });

        // Insertar datos en la base de datos
        const insertStmt = db.prepare(`INSERT INTO games (teamA, teamB, date, analysis) VALUES (?, ?, ?, ?)`);
        events.forEach(event => {
            const teamA = event.competitions[0].competitors[0].team.displayName;
            const teamB = event.competitions[0].competitors[1].team.displayName;
            const date = event.date;

            const analysis = analyzeGame(teamA, teamB); // Aplicar análisis

            insertStmt.run([teamA, teamB, date, analysis], (err) => {
                if (err) {
                    console.error('Error al insertar un juego en la base de datos:', err.message);
                }
            });
        });
        insertStmt.finalize();

        res.json({ message: 'Juegos guardados en la base de datos.' });
    } catch (error) {
        console.error('Error en /fetch-games:', error.message);
        res.status(500).json({ error: 'Error al obtener o procesar juegos.' });
    }
});

// Método de análisis (simulación)
function analyzeGame(teamA, teamB) {
    const scoreA = Math.random() * 30 + 10; // Simula puntos para el equipo A
    const scoreB = Math.random() * 30 + 10; // Simula puntos para el equipo B

    return scoreA > scoreB
        ? `${teamA} es favorito sobre ${teamB} con una proyección de ${scoreA.toFixed(2)} a ${scoreB.toFixed(2)}.`
        : `${teamB} es favorito sobre ${teamA} con una proyección de ${scoreB.toFixed(2)} a ${scoreA.toFixed(2)}.`;
}

// Endpoint para obtener todos los juegos desde la base de datos
app.get('/games', (req, res) => {
    db.all('SELECT * FROM games', [], (err, rows) => {
        if (err) {
            console.error('Error al obtener juegos de la base de datos:', err.message);
            res.status(500).json({ error: 'Error al obtener juegos de la base de datos.' });
        } else {
            res.json(rows);
        }
    });
});

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

// Actualizar automáticamente los juegos cada 1 hora
setInterval(async () => {
    try {
        console.log('Actualizando juegos desde la API...');
        const response = await fetch('http://localhost:3000/fetch-games');
        const result = await response.json();
        console.log(result.message);
    } catch (error) {
        console.error('Error al actualizar juegos automáticamente:', error.message);
    }
}, 3600000); // 3600000 ms = 1 hora

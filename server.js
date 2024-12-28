const express = require('express');
const Database = require('better-sqlite3'); // Usar better-sqlite3
const cors = require('cors');
const fetch = require('node-fetch'); // Asegúrate de que es la versión 2.6.7
const app = express();
const PORT = process.env.PORT || 3000; // Usar el puerto proporcionado por Railway

// Activar CORS para todas las solicitudes
app.use(cors());

// Conectar a la base de datos SQLite usando better-sqlite3
const db = new Database('./sports.db', { verbose: console.log });

// Crear tabla de juegos si no existe
db.prepare(`
    CREATE TABLE IF NOT EXISTS games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        teamA TEXT,
        teamB TEXT,
        date TEXT,
        analysis TEXT
    )
`).run();

// Endpoint básico para probar el servidor
app.get('/', (req, res) => {
    res.send('Servidor funcionando correctamente.');
});

// Endpoint para obtener próximos juegos y almacenarlos en la base de datos
app.get('/fetch-games', async (req, res) => {
    try {
        const url = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';

        let events;
        const useMockData = false; // Cambia a `true` para usar datos simulados

        if (useMockData) {
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
            events = mockData.events;
        } else {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Error al obtener datos de la API: ${response.statusText}`);
            }
            const data = await response.json();
            events = data.events;
        }

        if (!events || events.length === 0) {
            return res.status(404).json({ error: 'No se encontraron eventos.' });
        }

        // Limpiar la tabla antes de agregar nuevos datos
        db.prepare('DELETE FROM games').run();

        // Insertar datos en la base de datos
        const insertStmt = db.prepare(`INSERT INTO games (teamA, teamB, date, analysis) VALUES (?, ?, ?, ?)`);
        events.forEach(event => {
            const teamA = event.competitions[0].competitors[0].team.displayName;
            const teamB = event.competitions[0].competitors[1].team.displayName;
            const date = event.date;
            const analysis = analyzeGame(teamA, teamB);

            insertStmt.run(teamA, teamB, date, analysis);
        });

        res.json({ message: 'Juegos guardados en la base de datos.' });
    } catch (error) {
        console.error('Error en /fetch-games:', error.message);
        res.status(500).json({ error: 'Error al obtener o procesar juegos.' });
    }
});

// Método de análisis (simulación)
function analyzeGame(teamA, teamB) {
    const scoreA = Math.random() * 30 + 10;
    const scoreB = Math.random() * 30 + 10;

    return scoreA > scoreB
        ? `${teamA} es favorito sobre ${teamB} con una proyección de ${scoreA.toFixed(2)} a ${scoreB.toFixed(2)}.`
        : `${teamB} es favorito sobre ${teamA} con una proyección de ${scoreB.toFixed(2)} a ${scoreA.toFixed(2)}.`;
}

// Endpoint para obtener todos los juegos desde la base de datos
app.get('/games', (req, res) => {
    try {
        const rows = db.prepare('SELECT * FROM games').all();
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener juegos de la base de datos:', error.message);
        res.status(500).json({ error: 'Error al obtener juegos de la base de datos.' });
    }
});

// Actualización automática cada hora
setInterval(async () => {
    try {
        console.log('Actualizando juegos desde la API...');
        const response = await fetch('http://localhost:3000/fetch-games');
        const result = await response.json();
        console.log(result.message);
    } catch (error) {
        console.error('Error al actualizar juegos automáticamente:', error.message);
    }
}, 3600000);

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

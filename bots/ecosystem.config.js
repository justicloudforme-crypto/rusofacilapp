// RusoFásil — configuración de PM2 para mantener los 5 bots corriendo de
// forma permanente (reinicio automático si se caen, arranque automático al
// reiniciar la máquina vía `pm2 startup` + `pm2 save`).
//
// Uso:
//   pm2 start ecosystem.config.js   — arranca los 5 bots
//   pm2 status                      — ver estado de todos
//   pm2 logs <nombre>               — ver logs de uno (o `pm2 logs` para todos)
//   pm2 restart <nombre>            — reiniciar uno tras editar su código
//   pm2 save                        — persistir la lista actual para el auto-arranque

const PYTHON = "./.venv/bin/python3";

const bots = ["history_bot", "vocabulary_bot", "testing_bot", "moderator_bot", "notifier_bot"];

module.exports = {
  apps: bots.map((name) => ({
    name,
    script: `${name}/bot.py`,
    interpreter: PYTHON,
    cwd: __dirname,
    autorestart: true,
    restart_delay: 5000,
    max_restarts: 20,
    min_uptime: "30s",
    out_file: `logs/${name}.out.log`,
    error_file: `logs/${name}.err.log`,
    time: true,
  })),
};

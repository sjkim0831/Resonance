const { Client } = require("ssh2");

const args = process.argv.slice(2);
if (args[0] === "--auth") {
  process.env.SSH_USER = args[1] || process.env.SSH_USER;
  process.env.SSH_PASSWORD = args[2] || process.env.SSH_PASSWORD;
  args.splice(0, 3);
}
if (args.length === 0) {
  console.error("Usage: node ssh-run.js <command> | --put <local> <remote> | --get <remote> <local>");
  process.exit(2);
}

const conn = new Client();
conn
  .on("ready", () => {
    if (args[0] === "--put") {
      conn.sftp((err, sftp) => {
        if (err) {
          console.error(err.message);
          conn.end();
          process.exit(1);
        }
        sftp.fastPut(args[1], args[2], (putErr) => {
          if (putErr) {
            console.error(putErr.message);
            conn.end();
            process.exit(1);
          }
          conn.end();
        });
      });
      return;
    }
    if (args[0] === "--get") {
      conn.sftp((err, sftp) => {
        if (err) {
          console.error(err.message);
          conn.end();
          process.exit(1);
        }
        sftp.fastGet(args[1], args[2], (getErr) => {
          if (getErr) {
            console.error(getErr.message);
            conn.end();
            process.exit(1);
          }
          conn.end();
        });
      });
      return;
    }
    const command = args.join(" ");
    conn.exec(command, (err, stream) => {
      if (err) {
        console.error(err.message);
        conn.end();
        process.exit(1);
      }
      let exitCode = 0;
      stream
        .on("close", (code) => {
          exitCode = code ?? 0;
          conn.end();
          process.exit(exitCode);
        })
        .on("data", (data) => process.stdout.write(data));
      stream.stderr.on("data", (data) => process.stderr.write(data));
    });
  })
  .on("error", (err) => {
    console.error(err.message);
    process.exit(1);
  })
  .connect({
    host: "172.16.1.232",
    username: process.env.SSH_USER || "sjkim",
    password: process.env.SSH_PASSWORD || "qwer1234",
    readyTimeout: 15000
  });

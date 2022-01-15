import express from 'express';
import execa from 'execa';
import fs from 'fs';
import tmp from 'tmp';
import path from 'path';

async function handleCommand(command: string, args: string[]): Promise<{ stdout: string, stderr: string, code: number }> {
    let res = await execa(command, args, {
        timeout: 15000,
        reject: false,
        env: {
            FIFTPATH: path.resolve(__dirname, '..', 'libs')
        }
    });
    if (res.timedOut) {
        throw new Error('Timed out');
    }
    return {
        stdout: res.stdout,
        stderr: res.stderr,
        code: res.exitCode
    };
}

async function createTempFile(prefix: string, suffix: string) {
    return await new Promise<{ name: string, fd: number, removeCallback: () => void }>((resolve, reject) => {
        tmp.file({ prefix: prefix + '-', postfix: suffix }, (err, name, fd, removeCallback) => {
            if (err) {
                reject(err);
            } else {
                resolve({ name, fd, removeCallback });
            }
        });
    });
}

(async () => {
    const app = express();
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
    app.get('/', (req, res) => {
        res.send('Welcome to TON compiler!');
    });
    app.post('/compile', express.json(), (req, res) => {
        (async () => {
            try {
                let body = req.body as {
                    code: string,
                    libs: 'stdlib'[]
                };

                const codeFile = await createTempFile('contract', '.fc');
                const outputFile = await createTempFile('compiled', '.fif');
                const fifProgramFile = await createTempFile('script', '.fif');
                const outputCellFile = await createTempFile('compiled', '.cell');
                try {
                    // Prepare arguments
                    fs.writeFileSync(codeFile.fd, body.code, 'utf-8');
                    let args: string[] = [];
                    args.push('-PS');
                    args.push('-o');
                    args.push(outputFile.name);
                    for (let lib of body.libs) {
                        if (lib === 'stdlib') {
                            args.push(path.resolve(__dirname, '..', 'libs', 'stdlib.fc'));
                        } else {
                            throw Error('Invalid library: ' + lib);
                        }
                    }
                    args.push(codeFile.name);

                    // Compile
                    let compiled = await handleCommand('/usr/src/crypto/func', args);
                    let stdout = compiled.stdout;
                    let stderr = compiled.stderr;
                    let code = compiled.code;

                    // Prepare fift
                    let fift = fs.readFileSync(outputFile.fd, 'utf-8');
                    if (fift.indexOf('\n') >= 0) {
                        fift = fift.slice(fift.indexOf('\n') + 1); // Remove first line
                    }
                    if (fift.endsWith('\n')) {
                        fift = fift.slice(0, fift.length - 1);
                    }

                    // Fift compilation
                    let cell: Buffer | null = null;
                    if (code === 0) {
                        let fiftProgram = '"Asm.fif" include\n';
                        fiftProgram += fift + '\n';
                        fiftProgram += `boc>B "${outputCellFile.name}" B>file`;
                        fs.writeFileSync(fifProgramFile.fd, fiftProgram, 'utf-8');
                        let compiledFift = await handleCommand('/usr/src/crypto/fift', [fifProgramFile.name]);

                        code = compiledFift.code;
                        if (stdout !== '') {
                            stdout += '\n';
                        }
                        stdout += compiledFift.stdout;
                        if (stderr !== '') {
                            stderr += '\n';
                        }
                        stderr += compiledFift.stderr;

                        if (code === 0) {
                            cell = fs.readFileSync(outputCellFile.fd);
                        }
                    }

                    res.status(200).send({
                        exit_code: code,
                        stderr: stderr,
                        stdout: stdout,
                        fift,
                        cell: cell ? cell.toString('base64') : null
                    });
                } finally {
                    codeFile.removeCallback();
                    outputFile.removeCallback();
                    fifProgramFile.removeCallback();
                    outputCellFile.removeCallback();
                }
            } catch (e) {
                console.warn(e);
                res.status(500).send('500 Internal Error');
            }
        })()
    });
    await new Promise<void>((resolve) => app.listen(port, () => resolve()));
    console.log('🚀 Server started at http://localhost:' + port + '/');
})();
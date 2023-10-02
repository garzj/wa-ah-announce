let linePrefix = '';

function overrideLog(stream: NodeJS.WriteStream, prefix: string) {
  const oldWrite = stream.write.bind(stream);

  let pendingPrefix = true;
  stream.write = (buf: string | Uint8Array, a0?: any, a1?: any) => {
    let data = buf.toString();
    let lines = data.split(/\r|\n|\r\n/);
    lines = lines.map((line, i) => {
      let prependPrefix = i !== 0 || pendingPrefix;

      pendingPrefix = false;
      if (i === lines.length - 1 && line === '') {
        pendingPrefix = true;
        prependPrefix = false;
      }

      if (prependPrefix) {
        line = `[${new Date().toUTCString()}] [${prefix}] ${linePrefix}${line}`;
      }

      return line;
    });
    data = lines.join('\n');

    if (!stream.writable) return false;
    return oldWrite(data, a0, a1);
  };
}

overrideLog(process.stdout, 'LOG');
overrideLog(process.stderr, 'ERR');

export function prefixedLog(prefix: string, ...data: any[]) {
  linePrefix = `[${prefix}] `;
  console.log(...data);
  linePrefix = '';
}

export function prefixedErr(prefix: string, ...data: any[]) {
  linePrefix = `[${prefix}] `;
  console.error(...data);
  linePrefix = '';
}

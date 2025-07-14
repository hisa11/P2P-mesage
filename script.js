
document.addEventListener('DOMContentLoaded', function () {
    const peer = new Peer();
    let conn;
    const chatContainer = document.querySelector('.chat-container');
    const fileInput = document.getElementById('fileInput');
    const fileSelectionInfo = document.getElementById('file-selection-info');

    fileInput.addEventListener('change', () => {
        const files = fileInput.files;
        if (files.length === 0) {
            fileSelectionInfo.textContent = '';
        } else if (files.length === 1) {
            fileSelectionInfo.textContent = `選択中のファイル: ${files[0].name}`;
        } else {
            fileSelectionInfo.textContent = `${files.length}個のファイルを選択中`;
        }
    });

    peer.on('open', (id) => {
        document.getElementById('my-id').textContent = id;
        const connectUrl = window.location.origin + window.location.pathname + '?id=' + id;
        if ($ && $.fn.qrcode) {
            $('#qr').qrcode({
                width: 128,
                height: 128,
                text: connectUrl
            });
        }
    });

    peer.on('connection', (connection) => {
        conn = connection;
        appendMessage(`相手 (${connection.peer}) から接続要求がありました。`, 'system');
        setupConnection();
    });

    const params = new URLSearchParams(window.location.search);
    if (params.has('id')) {
        const targetId = params.get('id');
        document.getElementById('target-id').value = targetId;
        setTimeout(() => {
            appendMessage(`${targetId} に自動接続します...`, 'system');
            connect();
        }, 500);
    }

    function connect() {
        const targetId = document.getElementById('target-id').value;
        if (!targetId) {
            appendMessage('接続相手のIDを入力してください。', 'system');
            return;
        }
        appendMessage(`${targetId} に接続します...`, 'system');
        conn = peer.connect(targetId);
        setupConnection();
    }

    function setupConnection() {
        conn.on('open', () => {
            appendMessage(`接続成功！ (${conn.peer})`, 'system');
            document.getElementById('target-id').disabled = true;
            document.querySelector('button[onclick="connect()"]').disabled = true;
            chatContainer.classList.add('connected'); // 接続時にクラスを追加
        });

        conn.on('data', (data) => {
            if (data.type === 'text') {
                appendMessage(data.text, 'received');
            } else if (data.type === 'file') {
                const blob = new Blob([data.buffer], { type: data.mime });
                const url = URL.createObjectURL(blob);
                const container = document.createElement('div');
                
                const a = document.createElement('a');
                a.href = url;
                a.download = data.name;
                a.textContent = `📁 ${data.name} をダウンロード`;
                a.style.display = 'block';

                container.appendChild(a);

                if (data.mime && data.mime.startsWith('image/')) {
                    const img = document.createElement('img');
                    img.src = url;
                    img.alt = data.name;
                    img.style.maxWidth = '200px';
                    img.style.display = 'block';
                    img.style.marginTop = '5px';
                    container.appendChild(img);
                }
                appendMessage(container, 'received');
            }
        });

        conn.on('close', () => {
            appendMessage('接続が切れました。', 'system');
            document.getElementById('target-id').disabled = false;
            document.querySelector('button[onclick="connect()"]').disabled = false;
            chatContainer.classList.remove('connected'); // 切断時にクラスを削除
        });

        conn.on('error', (err) => {
            appendMessage('エラーが発生しました: ' + err, 'system');
        });
    }

    function send() {
        const msgInput = document.getElementById('msg');
        const msg = msgInput.value;
        const files = fileInput.files;

        if (!conn || !conn.open) {
            appendMessage('未接続です', 'system');
            return;
        }

        if (msg.trim()) {
            conn.send({ type: 'text', text: msg });
            appendMessage(msg, 'sent');
            msgInput.value = '';
        }

        if (files.length > 0) {
            sendFiles(files);
            fileInput.value = ''; // ファイル選択をクリア
            fileSelectionInfo.textContent = ''; // ファイル選択情報をクリア
        }
    }

    function sendFiles(files) {
        const progressContainer = document.getElementById('progress-container');
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        const progressPercentage = document.getElementById('progress-percentage');
        
        let filesProcessed = 0;
        const totalFiles = files.length;
        
        // 進捗バーを表示
        progressContainer.style.display = 'block';
        updateProgress(0, `ファイル送信準備中...`);
        
        for (const file of files) {
            const reader = new FileReader();
            
            reader.onload = function (e) {
                const data = {
                    type: 'file',
                    name: file.name,
                    mime: file.type || 'application/octet-stream',
                    buffer: e.target.result,
                    size: file.size
                };
                conn.send(data);
                
                const container = document.createElement('div');
                const text = document.createTextNode(`ファイル送信: ${file.name}`);
                container.appendChild(text);

                if (file.type.startsWith('image/')) {
                    const img = document.createElement('img');
                    img.src = URL.createObjectURL(file);
                    img.alt = file.name;
                    img.style.maxWidth = '200px';
                    img.style.display = 'block';
                    img.style.marginTop = '5px';
                    container.appendChild(img);
                }
                appendMessage(container, 'sent');
                
                // 進捗を更新
                filesProcessed++;
                const progressPercent = Math.round((filesProcessed / totalFiles) * 100);
                updateProgress(progressPercent, `ファイル送信中 (${filesProcessed}/${totalFiles})`);
                
                // 全ファイル送信完了時
                if (filesProcessed === totalFiles) {
                    setTimeout(() => {
                        progressContainer.style.display = 'none';
                    }, 1000); // 1秒後に進捗バーを非表示
                }
            };
            
            reader.readAsArrayBuffer(file);
        }
        
        function updateProgress(percent, text) {
            progressFill.style.width = percent + '%';
            progressText.textContent = text;
            progressPercentage.textContent = percent + '%';
        }
    }

    function appendMessage(content, type) {
        const logEl = document.getElementById('log');
        const messageEl = document.createElement('div');
        messageEl.classList.add('message', type);

        if (typeof content === 'string') {
            messageEl.textContent = content;
        } else {
            messageEl.appendChild(content);
        }
        
        if (type === 'system') {
            messageEl.classList.remove('message');
            messageEl.classList.add('system-message');
        }

        logEl.appendChild(messageEl);
        logEl.scrollTop = logEl.scrollHeight;
    }

    window.connect = connect;
    window.send = send;
});

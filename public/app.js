let currentTab = 'timeline';
let timelineData = [];
let currentContextType = 'both';
let currentContextData = null;
let currentTimelineFilter = 'all';

async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        
        document.getElementById('totalItems').textContent = data.totalItems;
        document.getElementById('audioCount').textContent = data.audioCount;
        document.getElementById('imageCount').textContent = data.imageCount;
        document.getElementById('queueCount').textContent = data.processingQueue.queued + data.processingQueue.processing;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function loadTimeline() {
    const container = document.getElementById('timelineList');
    const horizontalBar = document.getElementById('horizontalTimelineBar');
    container.innerHTML = '<div class="loading">Loading timeline...</div>';
    horizontalBar.innerHTML = '<div class="loading-small">Loading...</div>';
    
    try {
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        
        let url = '/api/timeline';
        const params = new URLSearchParams();
        if (startDate) params.append('start', new Date(startDate).toISOString());
        if (endDate) params.append('end', new Date(endDate).toISOString());
        if (params.toString()) url += '?' + params.toString();
        
        const response = await fetch(url);
        let allData = await response.json();
        
        // Reverse to show most recent first
        allData.reverse();
        timelineData = allData;
        
        // Apply type filter
        let filteredData = currentTimelineFilter === 'all' 
            ? allData 
            : allData.filter(item => item.type === currentTimelineFilter);
        
        if (filteredData.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📅</div>
                    <div class="empty-state-text">No memories yet</div>
                    <div class="empty-state-subtext">Captured audio and images will appear here</div>
                </div>
            `;
            horizontalBar.innerHTML = '<div class="loading-small">No data</div>';
            return;
        }
        
        // Render horizontal timeline
        renderHorizontalTimeline(allData);
        
        // Render list view
        container.innerHTML = filteredData.map((item, index) => {
            const date = new Date(item.timestamp);
            const dateStr = date.toLocaleDateString();
            const timeStr = date.toLocaleTimeString();
            const typeIcon = item.type === 'audio' ? '🎵' : '📷';
            const typeClass = item.type;
            const truncatedContent = item.content.length > 200 
                ? item.content.substring(0, 200) + '...' 
                : item.content;
            
            let preview = '';
            if (item.type === 'image') {
                preview = `<img src="${item.mediaUrl}" alt="${item.filename}" class="timeline-preview" data-item-index="${index}">`;
            }
            
            return `
                <div class="timeline-item" data-item-index="${index}">
                    <div class="timeline-time">
                        <div class="date">${dateStr}</div>
                        <div class="time">${timeStr}</div>
                    </div>
                    <div class="timeline-content">
                        <div class="timeline-header">
                            <span class="timeline-type ${typeClass}">${typeIcon} ${item.type === 'audio' ? 'Audio' : 'Image'}</span>
                            <span class="timeline-filename">${item.filename}</span>
                        </div>
                        <div class="timeline-text">${escapeHtml(truncatedContent)}</div>
                        <div class="timeline-actions">
                            <button class="btn btn-primary" data-item-index="${index}">
                                ${item.type === 'audio' ? '▶️ Play' : '👁️ View'}
                            </button>
                        </div>
                    </div>
                    ${preview}
                </div>
            `;
        }).join('');
        
        // Add click event listeners
        container.querySelectorAll('[data-item-index]').forEach(el => {
            el.addEventListener('click', (e) => {
                const index = parseInt(el.dataset.itemIndex);
                const item = filteredData[index];
                if (item) {
                    openMedia(item.type, item.filename, item.mediaUrl, item.content);
                }
            });
        });
    } catch (error) {
        console.error('Error loading timeline:', error);
        container.innerHTML = '<div class="empty-state"><div class="empty-state-text">Failed to load timeline</div></div>';
        horizontalBar.innerHTML = '<div class="loading-small">Error</div>';
    }
}

function setTimelineFilter(filter) {
    currentTimelineFilter = filter;
    
    document.querySelectorAll('.timeline-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    
    // Re-render with current data
    if (timelineData.length > 0) {
        const filteredData = filter === 'all' 
            ? timelineData 
            : timelineData.filter(item => item.type === filter);
        
        const container = document.getElementById('timelineList');
        
        if (filteredData.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📅</div>
                    <div class="empty-state-text">No ${filter} items</div>
                    <div class="empty-state-subtext">Try selecting a different filter</div>
                </div>
            `;
            return;
        }
        
        container.innerHTML = filteredData.map((item, index) => {
            const date = new Date(item.timestamp);
            const dateStr = date.toLocaleDateString();
            const timeStr = date.toLocaleTimeString();
            const typeIcon = item.type === 'audio' ? '🎵' : '📷';
            const typeClass = item.type;
            const truncatedContent = item.content.length > 200 
                ? item.content.substring(0, 200) + '...' 
                : item.content;
            
            let preview = '';
            if (item.type === 'image') {
                preview = `<img src="${item.mediaUrl}" alt="${item.filename}" class="timeline-preview" data-item-index="${index}">`;
            }
            
            return `
                <div class="timeline-item" data-item-index="${index}">
                    <div class="timeline-time">
                        <div class="date">${dateStr}</div>
                        <div class="time">${timeStr}</div>
                    </div>
                    <div class="timeline-content">
                        <div class="timeline-header">
                            <span class="timeline-type ${typeClass}">${typeIcon} ${item.type === 'audio' ? 'Audio' : 'Image'}</span>
                            <span class="timeline-filename">${item.filename}</span>
                        </div>
                        <div class="timeline-text">${escapeHtml(truncatedContent)}</div>
                        <div class="timeline-actions">
                            <button class="btn btn-primary" data-item-index="${index}">
                                ${item.type === 'audio' ? '▶️ Play' : '👁️ View'}
                            </button>
                        </div>
                    </div>
                    ${preview}
                </div>
            `;
        }).join('');
        
        // Add click event listeners
        container.querySelectorAll('[data-item-index]').forEach(el => {
            el.addEventListener('click', (e) => {
                const index = parseInt(el.dataset.itemIndex);
                const item = filteredData[index];
                if (item) {
                    openMedia(item.type, item.filename, item.mediaUrl, item.content);
                }
            });
        });
    }
}

function renderHorizontalTimeline(data) {
    const horizontalBar = document.getElementById('horizontalTimelineBar');
    
    if (data.length === 0) {
        horizontalBar.innerHTML = '<div class="loading-small">No data</div>';
        return;
    }
    
    // Find time range
    const timestamps = data.map(item => new Date(item.timestamp).getTime());
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    const timeRange = maxTime - minTime || 1;
    
    // Create dots
    horizontalBar.innerHTML = '';
    
    data.forEach((item, index) => {
        const timestamp = new Date(item.timestamp).getTime();
        const position = ((timestamp - minTime) / timeRange) * 100;
        
        const dot = document.createElement('div');
        dot.className = `timeline-dot ${item.type}`;
        dot.style.left = `${position}%`;
        
        const truncatedContent = item.content.length > 150 
            ? item.content.substring(0, 150) + '...' 
            : item.content;
        
        const tooltip = document.createElement('div');
        tooltip.className = 'timeline-tooltip';
        
        const date = new Date(item.timestamp);
        const typeIcon = item.type === 'audio' ? '🎵' : '📷';
        
        let tooltipContent = `
            <div class="timeline-tooltip-header">
                <span>${typeIcon} ${item.type === 'audio' ? 'Audio' : 'Image'}</span>
                <span class="timeline-tooltip-time">${date.toLocaleString()}</span>
            </div>
        `;
        
        if (item.type === 'image') {
            tooltipContent += `<img src="${item.mediaUrl}" class="timeline-tooltip-preview" alt="${item.filename}">`;
        }
        
        tooltipContent += `<div class="timeline-tooltip-text">${escapeHtml(truncatedContent)}</div>`;
        
        tooltip.innerHTML = tooltipContent;
        dot.appendChild(tooltip);
        
        dot.addEventListener('click', () => {
            openMedia(item.type, item.filename, item.mediaUrl, item.content);
        });
        
        horizontalBar.appendChild(dot);
    });
}

function clearFilters() {
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    loadTimeline();
}

async function performSearch() {
    const query = document.getElementById('searchInput').value.trim();
    const container = document.getElementById('searchResults');
    
    if (!query) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🔍</div>
                <div class="empty-state-text">Enter a search term</div>
                <div class="empty-state-subtext">Search across all your audio transcriptions and image descriptions</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '<div class="loading">Searching...</div>';
    
    try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const results = await response.json();
        
        if (results.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🔍</div>
                    <div class="empty-state-text">No results found</div>
                    <div class="empty-state-subtext">Try different keywords</div>
                </div>
            `;
            return;
        }
        
        container.innerHTML = results.map((item, index) => {
            const date = new Date(item.timestamp);
            const typeIcon = item.type === 'audio' ? '🎵' : '📷';
            const highlightedSnippet = highlightText(item.snippet, query);
            
            return `
                <div class="search-result">
                    <div class="timeline-header">
                        <span class="timeline-type ${item.type}">${typeIcon} ${item.type === 'audio' ? 'Audio' : 'Image'}</span>
                        <span class="timeline-filename">${item.filename}</span>
                        <span style="color: #999; font-size: 0.85rem;">${date.toLocaleString()}</span>
                    </div>
                    <div class="snippet">${highlightedSnippet}</div>
                    <div class="timeline-actions">
                        <button class="btn btn-primary" data-search-index="${index}">
                            ${item.type === 'audio' ? '▶️ Play' : '👁️ View'}
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        // Add click event listeners for search results
        container.querySelectorAll('[data-search-index]').forEach(el => {
            el.addEventListener('click', (e) => {
                const index = parseInt(el.dataset.searchIndex);
                const item = results[index];
                if (item) {
                    openMedia(item.type, item.filename, item.mediaUrl, item.content);
                }
            });
        });
    } catch (error) {
        console.error('Error searching:', error);
        container.innerHTML = '<div class="empty-state"><div class="empty-state-text">Search failed</div></div>';
    }
}

function highlightText(text, query) {
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    return escapeHtml(text).replace(regex, '<span class="highlight">$1</span>');
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function handleSearchKey(event) {
    if (event.key === 'Enter') {
        performSearch();
    }
}

function setContextType(type) {
    currentContextType = type;
    
    document.querySelectorAll('.context-type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
    });
    
    updateContextPreview();
}

function setContextRange(range) {
    const now = new Date();
    let start;
    
    switch (range) {
        case '5min':
            start = new Date(now.getTime() - 5 * 60 * 1000);
            break;
        case '10min':
            start = new Date(now.getTime() - 10 * 60 * 1000);
            break;
        case '30min':
            start = new Date(now.getTime() - 30 * 60 * 1000);
            break;
        case 'hour':
            start = new Date(now.getTime() - 60 * 60 * 1000);
            break;
        case 'day':
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
        case 'week':
            start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        case 'all':
            document.getElementById('chatStartDate').value = '';
            document.getElementById('chatEndDate').value = '';
            updateContextPreview();
            return;
    }
    
    document.getElementById('chatStartDate').value = formatDateTimeLocal(start);
    document.getElementById('chatEndDate').value = formatDateTimeLocal(now);
    updateContextPreview();
}

function formatDateTimeLocal(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

async function sendChat() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    const sendBtn = document.getElementById('sendBtn');
    
    if (!message) return;
    
    const messagesContainer = document.getElementById('chatMessages');
    
    const welcome = messagesContainer.querySelector('.chat-welcome');
    if (welcome) welcome.remove();
    
    messagesContainer.innerHTML += `
        <div class="chat-message user">${escapeHtml(message)}</div>
    `;
    
    input.value = '';
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<span>⏳</span> Thinking...';
    
    messagesContainer.innerHTML += `
        <div class="chat-message assistant" id="pendingMessage">
            <em>Thinking...</em>
        </div>
    `;
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    try {
        const startTime = document.getElementById('chatStartDate').value;
        const endTime = document.getElementById('chatEndDate').value;
        
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message,
                startTime: startTime ? new Date(startTime).toISOString() : null,
                endTime: endTime ? new Date(endTime).toISOString() : null,
                contextType: currentContextType
            })
        });
        
        const data = await response.json();
        
        const pendingMsg = document.getElementById('pendingMessage');
        if (response.ok) {
            let contextInfo = '';
            if (data.contextItemCount > 0) {
                contextInfo = `<div class="context-info">Based on ${data.contextItemCount} memories`;
                if (data.timeRange.start && data.timeRange.end) {
                    const start = new Date(data.timeRange.start).toLocaleString();
                    const end = new Date(data.timeRange.end).toLocaleString();
                    contextInfo += ` from ${start} to ${end}`;
                }
                contextInfo += '</div>';
            }
            pendingMsg.innerHTML = escapeHtml(data.reply).replace(/\n/g, '<br>') + contextInfo;
        } else {
            pendingMsg.innerHTML = `<em style="color: #dc3545;">Error: ${data.error}</em>`;
        }
        pendingMsg.removeAttribute('id');
    } catch (error) {
        console.error('Chat error:', error);
        const pendingMsg = document.getElementById('pendingMessage');
        pendingMsg.innerHTML = '<em style="color: #dc3545;">Failed to get response</em>';
        pendingMsg.removeAttribute('id');
    }
    
    sendBtn.disabled = false;
    sendBtn.innerHTML = '<span>📤</span> Send';
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function handleChatKey(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendChat();
    }
}

async function loadStatus() {
    try {
        const [statusRes, historyRes] = await Promise.all([
            fetch('/api/status'),
            fetch('/api/history')
        ]);
        
        const status = await statusRes.json();
        const history = await historyRes.json();
        
        const queueContainer = document.getElementById('queueStatus');
        if (status.current || status.queue.length > 0) {
            let html = '';
            if (status.current) {
                html += `
                    <div class="queue-item">
                        <span>⚙️ Processing: ${status.current.filename}</span>
                        <span class="timeline-type ${status.current.type}">${status.current.type}</span>
                    </div>
                `;
            }
            status.queue.forEach(item => {
                html += `
                    <div class="queue-item">
                        <span>⏳ Queued: ${item.filename}</span>
                        <span class="timeline-type ${item.type}">${item.type}</span>
                    </div>
                `;
            });
            queueContainer.innerHTML = html;
        } else {
            queueContainer.innerHTML = '<div class="queue-empty">No items in queue</div>';
        }
        
        const activityContainer = document.getElementById('recentActivity');
        const recentCompleted = history.completed.slice(-5).reverse();
        const recentFailed = history.failed.slice(-3).reverse();
        
        if (recentCompleted.length === 0 && recentFailed.length === 0) {
            activityContainer.innerHTML = '<div class="queue-empty">No recent activity</div>';
        } else {
            let html = '';
            recentCompleted.forEach(item => {
                const time = new Date(item.completedAt).toLocaleString();
                html += `
                    <div class="activity-item completed">
                        <span>✅ ${item.filename}</span>
                        <span style="color: #999; font-size: 0.85rem;">${time}</span>
                    </div>
                `;
            });
            recentFailed.forEach(item => {
                const time = new Date(item.failedAt).toLocaleString();
                html += `
                    <div class="activity-item failed">
                        <span>❌ ${item.filename}</span>
                        <span style="color: #999; font-size: 0.85rem;">${item.error}</span>
                    </div>
                `;
            });
            activityContainer.innerHTML = html;
        }
    } catch (error) {
        console.error('Error loading status:', error);
    }
}

function openMedia(type, filename, mediaUrl, content) {
    const modal = document.getElementById('mediaModal');
    const modalBody = document.getElementById('modalBody');
    
    let mediaHtml = '';
    if (type === 'audio') {
        mediaHtml = `
            <audio controls autoplay>
                <source src="${mediaUrl}" type="audio/wav">
                Your browser does not support the audio element.
            </audio>
        `;
    } else {
        mediaHtml = `<img src="${mediaUrl}" alt="${filename}">`;
    }
    
    modalBody.innerHTML = `
        ${mediaHtml}
        <div class="modal-info">
            <h4>${type === 'audio' ? '🎵 Audio Transcription' : '📷 Image Description'}</h4>
            <p><strong>File:</strong> ${filename}</p>
            <p>${content}</p>
        </div>
    `;
    
    modal.classList.add('active');
}

function closeModal(event) {
    if (event && event.target !== document.getElementById('mediaModal')) return;
    const modal = document.getElementById('mediaModal');
    modal.classList.remove('active');
    
    const audio = modal.querySelector('audio');
    if (audio) audio.pause();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function switchTab(tabName) {
    currentTab = tabName;
    
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `${tabName}-tab`);
    });
    
    if (tabName === 'timeline') loadTimeline();
    if (tabName === 'status') loadStatus();
}

document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
        closeContextModal();
    }
});

async function updateContextPreview() {
    const startTime = document.getElementById('chatStartDate').value;
    const endTime = document.getElementById('chatEndDate').value;
    
    try {
        let url = '/api/timeline';
        const params = new URLSearchParams();
        if (startTime) params.append('start', new Date(startTime).toISOString());
        if (endTime) params.append('end', new Date(endTime).toISOString());
        if (params.toString()) url += '?' + params.toString();
        
        const response = await fetch(url);
        let results = await response.json();
        
        if (currentContextType !== 'both') {
            results = results.filter(r => r.type === currentContextType);
        }
        
        currentContextData = results;
        
        const contextInfo = document.getElementById('contextInfo');
        const contextSummary = document.getElementById('contextSummary');
        
        if (results.length === 0) {
            contextInfo.style.display = 'none';
            return;
        }
        
        const audioCount = results.filter(r => r.type === 'audio').length;
        const imageCount = results.filter(r => r.type === 'image').length;
        
        let summaryText = `📊 ${results.length} item${results.length !== 1 ? 's' : ''} ready`;
        if (currentContextType === 'both') {
            summaryText += ` (${audioCount} audio, ${imageCount} images)`;
        }
        
        contextSummary.textContent = summaryText;
        contextInfo.style.display = 'flex';
    } catch (error) {
        console.error('Error loading context preview:', error);
    }
}

function showContextPreview() {
    if (!currentContextData || currentContextData.length === 0) {
        alert('No context available. Select a time range first.');
        return;
    }
    
    const contextParts = [];
    let audioCount = 0;
    let imageCount = 0;
    let totalChars = 0;
    
    for (const r of currentContextData) {
        const time = new Date(r.timestamp).toLocaleString();
        const typeLabel = r.type === 'audio' ? 'Audio Transcription' : 'Image Description';
        
        let content = r.content;
        if (content.length > 500) {
            content = content.substring(0, 500) + '... [truncated for LLM]';
        }
        
        const part = `[${time}] ${typeLabel} (${r.filename}):\n${content}`;
        contextParts.push(part);
        totalChars += part.length;
        
        if (r.type === 'audio') audioCount++;
        else imageCount++;
    }
    
    const contextText = contextParts.join('\n\n---\n\n');
    
    document.getElementById('contextPreviewText').value = contextText;
    
    const statsHtml = `
        <div>
            <div class="stat-label">Total Items</div>
            <div class="stat-value">${currentContextData.length}</div>
        </div>
        <div>
            <div class="stat-label">Audio</div>
            <div class="stat-value">${audioCount}</div>
        </div>
        <div>
            <div class="stat-label">Images</div>
            <div class="stat-value">${imageCount}</div>
        </div>
        <div>
            <div class="stat-label">Characters</div>
            <div class="stat-value">${totalChars.toLocaleString()}</div>
        </div>
    `;
    
    document.getElementById('contextStats').innerHTML = statsHtml;
    document.getElementById('contextModal').classList.add('active');
}

function closeContextModal(event) {
    if (event && event.target !== document.getElementById('contextModal')) return;
    document.getElementById('contextModal').classList.remove('active');
}

async function copyContextToClipboard() {
    const text = document.getElementById('contextPreviewText').value;
    try {
        await navigator.clipboard.writeText(text);
        const btn = event.target;
        const originalText = btn.innerHTML;
        btn.innerHTML = '✅ Copied!';
        setTimeout(() => {
            btn.innerHTML = originalText;
        }, 2000);
    } catch (error) {
        alert('Failed to copy to clipboard. Please select and copy manually.');
    }
}

loadStats();
loadTimeline();

setInterval(loadStats, 30000);

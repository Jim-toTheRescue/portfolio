import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from '../utils/router';
import { getNotesBySymbol, getNotesByPortfolioId, getAllNotes, addNote, updateNote, deleteNote } from '../utils/notes';
import { parseMarket } from '../utils/helpers';
import { getActivePortfolio, setActivePortfolio } from '../utils/manfolio';
import StockSymbol from './StockSymbol';

export default function NotesPage() {
  const params = useParams();
  const symbol = params.symbol;
  const { navigate } = useRouter();

  const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const name = urlParams.get('name') || symbol;
  const portfolioId = urlParams.get('portfolioId');

  // 如果是组合评论区且URL有portfolioId，设置active portfolio
  useEffect(() => {
    if (portfolioId && symbol) {
      setActivePortfolio(portfolioId);
    }
  }, [portfolioId, symbol]);

  const getBackUrl = () => {
    if (window.history.length > 1) {
      return null;
    }
    return portfolioId ? '/manfolio' : '/notes';
  };

  const goBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      navigate(getBackUrl());
    }
  };

  const { market } = portfolioId ? { market: null } : parseMarket(symbol);
  const marketLabels = { US: '美', HK: '港', SH: '沪', SZ: '深' };

  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingNote, setEditingNote] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [expandedNotes, setExpandedNotes] = useState({});
  const [inputContent, setInputContent] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showAddInput, setShowAddInput] = useState(false);
  const [portfolioStocks, setPortfolioStocks] = useState([]);
  const [stockCounts, setStockCounts] = useState({});
  const addInputRef = useRef(null);

  useEffect(() => {
    if (portfolioId) {
      const p = getActivePortfolio();
      if (p?.positions) {
        const stocks = p.positions.map(pos => ({
          symbol: pos.symbol,
          name: pos.name || pos.symbol
        }));
        setPortfolioStocks(stocks);
        // 加载各股票评论数
        getAllNotes().then(allNotes => {
          const counts = {};
          allNotes.forEach(note => {
            if (!note.portfolioId) {
              counts[note.symbol] = (counts[note.symbol] || 0) + 1;
            }
          });
          setStockCounts(counts);
        });
      }
    }
  }, [portfolioId]);

  useEffect(() => {
    if (showAddInput && addInputRef.current) {
      addInputRef.current.focus();
    }
  }, [showAddInput]);

  const toggleExpand = (noteId) => {
    setExpandedNotes(prev => ({
      ...prev,
      [noteId]: !prev[noteId]
    }));
  };

  useEffect(() => {
    loadNotes();
  }, [symbol, portfolioId]);

  const loadNotes = async () => {
    setLoading(true);
    try {
      let data;
      if (portfolioId) {
        data = await getNotesByPortfolioId(portfolioId);
      } else {
        data = await getNotesBySymbol(symbol);
      }
      setNotes(data);
      setExpandedNotes({});
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!inputContent.trim()) return;
    try {
      const p = getActivePortfolio();
      // 组合评论区发帖 symbol 为 null
      const noteSymbol = portfolioId ? null : symbol;
      await addNote(noteSymbol, name, inputContent.trim(), false, null, portfolioId, p?.name);
      setInputContent('');
      setShowAddInput(false);
      loadNotes();
    } catch (e) {
      console.error(e);
    }
  };

  const handleReply = async (parentId) => {
    if (!inputContent.trim()) return;
    try {
      const parentNote = notes.find(n => n.id === parentId);
      const parentPortfolioId = parentNote?.portfolioId;
      const parentSymbol = parentNote?.symbol;
      const parentPortfolioName = parentNote?.portfolioName;
      const p = getActivePortfolio();
      // 子评论继承父评论的 symbol, portfolioId 和 portfolioName，确保同步到两边
      const noteSymbol = parentSymbol || (portfolioId ? null : symbol);
      await addNote(noteSymbol, name, inputContent.trim(), false, parentId, parentPortfolioId || portfolioId, parentPortfolioName || p?.name);
      setInputContent('');
      setReplyingTo(null);
      loadNotes();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (noteId) => {
    if (confirmDelete === noteId) {
      try {
        await deleteNote(noteId);
        setConfirmDelete(null);
        loadNotes();
      } catch (e) {
        console.error(e);
      }
    } else {
      setConfirmDelete(noteId);
    }
  };

  const formatTime = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleString('zh-CN', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const buildTree = (notes) => {
    const map = {};
    const roots = [];
    notes.forEach(n => {
      map[n.id] = { ...n, children: [] };
    });
    notes.forEach(n => {
      if (n.parentId && map[n.parentId]) {
        map[n.parentId].children.push(map[n.id]);
      } else {
        roots.push(map[n.id]);
      }
    });
    return roots;
  };

  const renderNote = (note, depth = 0) => {
    const indent = depth * 20;
    return (
      <div key={note.id} style={{ marginLeft: `${indent}px`, position: 'relative' }}>
        {depth > 0 && (
          <div style={{
            position: 'absolute',
            left: '-12px',
            top: '0',
            bottom: note.children.length === 0 ? '0' : '-20px',
            width: '2px',
            background: 'var(--border)'
          }} />
        )}
        
        <div style={{
          background: note.isSystem ? 'var(--bg-secondary)' : 'rgba(66, 133, 244, 0.04)',
          borderRadius: '12px',
          padding: '12px',
          marginBottom: '12px',
          border: '1px solid var(--border)',
          borderLeft: note.isSystem ? '3px solid var(--border)' : '3px solid var(--blue)',
          position: 'relative',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.boxShadow = 'none';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
        >
          {!note.isSystem && (
            <div style={{
              position: 'absolute',
              left: '-1px',
              top: '0',
              bottom: '0',
              writingMode: 'vertical-rl',
              textOrientation: 'mixed',
              fontSize: '0.5rem',
              padding: '8px 2px',
              borderRadius: '4px 0 0 4px',
              background: 'rgba(66, 133, 244, 0.6)',
              color: '#fff',
              transform: 'translateX(-100%)',
              letterSpacing: '1px',
            }}>
              评论
            </div>
          )}
          {note.isSystem && (
            <div style={{
              position: 'absolute',
              left: '-1px',
              top: '0',
              bottom: '0',
              writingMode: 'vertical-rl',
              textOrientation: 'mixed',
              fontSize: '0.5rem',
              padding: '8px 2px',
              borderRadius: '4px 0 0 4px',
              background: 'var(--text-secondary)',
              color: '#fff',
              transform: 'translateX(-100%)',
              letterSpacing: '1px',
            }}>
              系统
            </div>
          )}
          
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '8px',
            paddingBottom: '8px',
            borderBottom: '1px solid var(--border)'
          }}>
            <div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                {formatTime(note.createdAt)}
              </span>
              <>
                <button 
                  onClick={() => {
                    setReplyingTo(note);
                    setInputContent('');
                  }}
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    cursor: 'pointer',
                    color: 'var(--blue)',
                    fontSize: '0.75rem',
                    marginLeft: '12px'
                  }}
                >
                  评论
                </button>
                {!note.isSystem && (
                  <button 
                    onClick={() => {
                      setEditingNote(note);
                      setInputContent(note.content);
                    }}
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      cursor: 'pointer',
                      color: 'var(--text-secondary)',
                      fontSize: '0.75rem',
                      marginLeft: '8px'
                    }}
                  >
                    编辑
                  </button>
                )}
              </>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {note.portfolioId && (
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginRight: '12px' }}>
                  来自组合: 
                  <span 
                    onClick={() => navigate(`/folio/${note.portfolioId}`)}
                    style={{ 
                      color: 'var(--blue)', 
                      cursor: 'pointer'
                    }}
                  >
                    {note.portfolioName || note.portfolioId}
                  </span>
                </span>
              )}
              <button 
                onClick={() => handleDelete(note.id)}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  cursor: 'pointer',
                  color: confirmDelete === note.id ? 'red' : 'var(--text-secondary)',
                  fontSize: '0.85rem'
                }}
              >
                {confirmDelete === note.id ? '确认' : '×'}
              </button>
            </div>
          </div>
          <div style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: '1.5', fontSize: '0.9rem' }}>
            {editingNote?.id === note.id ? (
              <div>
                <textarea
                  value={inputContent}
                  onChange={e => setInputContent(e.target.value)}
                  style={{
                    width: '100%',
                    minHeight: '80px',
                    padding: '8px',
                    borderRadius: '6px',
                    border: '1px solid var(--blue)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                  autoFocus
                />
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button 
                    onClick={() => { setEditingNote(null); setInputContent(''); }}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '4px',
                      border: '1px solid var(--border)',
                      background: 'transparent',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '0.75rem'
                    }}
                  >
                    取消
                  </button>
                  <button 
                    onClick={async () => {
                      if (!inputContent.trim()) return;
                      try {
                        await updateNote(note.id, inputContent.trim());
                        setEditingNote(null);
                        setInputContent('');
                        loadNotes();
                      } catch (e) {
                        console.error(e);
                      }
                    }}
                    disabled={!inputContent.trim()}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '4px',
                      border: 'none',
                      background: 'var(--blue)',
                      color: '#fff',
                      cursor: inputContent.trim() ? 'pointer' : 'not-allowed',
                      fontSize: '0.75rem'
                    }}
                  >
                    保存
                  </button>
                </div>
              </div>
            ) : (
              note.content
            )}
          </div>
          {note.children.length > 0 && (
            <div 
              onClick={() => toggleExpand(note.id)}
              style={{
                marginTop: '8px',
                padding: '6px 12px',
                color: expandedNotes[note.id] === true ? 'var(--blue)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '0.8rem',
                borderRadius: '4px',
                background: 'rgba(0,0,0,0.02)'
              }}
            >
              {expandedNotes[note.id] === true 
                ? `收起 ${note.children.length} 条回复 ▲` 
                : `展开 ${note.children.length} 条回复 ▼`}
            </div>
          )}
        </div>

        {replyingTo?.id === note.id && (
          <div style={{ marginBottom: '12px', marginLeft: '16px' }}>
            <textarea
              value={inputContent}
              onChange={e => setInputContent(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (inputContent.trim()) handleReply(note.id);
                }
              }}
              placeholder="写下回复..."
              style={{
                width: '100%',
                minHeight: '80px',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                resize: 'vertical'
              }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => { setReplyingTo(null); setInputContent(''); }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                取消
              </button>
              <button 
                onClick={() => handleReply(note.id)}
                disabled={!inputContent.trim()}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: 'var(--blue)',
                  color: '#fff',
                  cursor: inputContent.trim() ? 'pointer' : 'not-allowed',
                  opacity: inputContent.trim() ? 1 : 0.5
                }}
              >
                回复
              </button>
            </div>
          </div>
        )}

        {note.children.length > 0 && expandedNotes[note.id] === true && (
          note.children.map(child => renderNote(child, depth + 1))
        )}

      </div>
    );
  };

  if (loading) {
    return (
      <div className="app">
        <div className="header">
          <h1>加载中...</h1>
        </div>
      </div>
    );
  }

  const noteTree = buildTree(notes);

  return (
    <div className="app">
      <div className="header" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <h1>
          <span onClick={goBack} style={{ cursor: 'pointer' }}>返回</span>
        </h1>
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          gap: '8px'
        }}>
          <StockSymbol symbol={symbol} style={{ fontWeight: 'bold' }} linkable={!portfolioId} />
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{name}</span>
          {market && (
            <span style={{ 
              fontSize: '0.7rem', 
              padding: '2px 6px', 
              background: 'var(--primary)',
              borderRadius: '4px',
              color: '#fff'
            }}>{marketLabels[market]}</span>
          )}
        </div>
        <div className="header-buttons">
          <button className="btn btn-secondary" onClick={() => setShowAddInput(!showAddInput)}>评论</button>
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        {portfolioId && portfolioStocks.length > 0 && (
          <div style={{ marginTop: '12px', marginBottom: '12px' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>组合股票评论区</div>
            <div style={{ display: 'flex', overflowX: 'auto', gap: '12px', paddingBottom: '8px' }}>
              {portfolioStocks.map(stock => (
                <div 
                  key={stock.symbol}
                  className="portfolio-card"
                  style={{ minWidth: '200px', flexShrink: 0 }}
                  onClick={() => navigate(`/note/${stock.symbol}?name=${encodeURIComponent(stock.name)}`)}
                >
                  <div className="portfolio-card-header">
                    <StockSymbol symbol={stock.symbol} className="portfolio-name" style={{ fontWeight: 'bold' }} />
                  </div>
                  <div className="portfolio-stats">
                    <div className="stat-item">
                      <span className="stat-label">股票名</span>
                      <span className="stat-value">{stock.name}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">评论数</span>
                      <span className="stat-value">{stockCounts[stock.symbol] || 0}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {showAddInput && (
        <div style={{
          background: 'var(--bg-secondary)',
          borderRadius: '12px',
          padding: '12px',
          marginBottom: '16px',
          border: '1px solid var(--border)'
        }}>
          <textarea
            ref={addInputRef}
            value={inputContent}
            onChange={e => setInputContent(e.target.value)}
            placeholder="写下你的评论..."
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (inputContent.trim()) handleAdd();
              }
            }}
            style={{
              width: '100%',
              minHeight: '80px',
              padding: '10px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '14px',
              resize: 'vertical',
              fontFamily: 'inherit'
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button 
              onClick={handleAdd}
              disabled={!inputContent.trim()}
              style={{
                padding: '6px 16px',
                borderRadius: '6px',
                border: 'none',
                background: 'var(--blue)',
                color: '#fff',
                cursor: inputContent.trim() ? 'pointer' : 'not-allowed',
                opacity: inputContent.trim() ? 1 : 0.5
              }}
            >
              发表评论
            </button>
          </div>
        </div>
        )}
        {notes.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px' }}>
            暂无评论
          </div>
        ) : (
          <div>
            {noteTree.map(note => renderNote(note))}
          </div>
        )}
      </div>
    </div>
  );
}
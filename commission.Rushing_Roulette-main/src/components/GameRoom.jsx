import React, { useEffect, useState } from 'react';
import { getDatabase, ref, onDisconnect, remove, set, onValue } from 'firebase/database';
import { getAuth } from 'firebase/auth';
import './GameRoom.css'; // 반드시 CSS 파일을 연동해주세요!

const GameRoom = ({ roomId }) => {
  const db = getDatabase();
  const auth = getAuth();
  const myId = auth.currentUser?.uid;

  const [gameState, setGameState] = useState({ state: 'idle', turnPlayerId: null });
  const [players, setPlayers] = useState({});

  useEffect(() => {
    if (!myId) return;

    const playerRef = ref(db, `rooms/${roomId}/players/${myId}`);
    const roomRef = ref(db, `rooms/${roomId}`);

    // [1. 방 자동 초기화] 브라우저 종료/연결 끊김 시 내 데이터 삭제 예약
    onDisconnect(playerRef).remove();

    // 플레이어 목록 및 방 상태 실시간 구독
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setGameState({ state: data.state || 'idle', turnPlayerId: data.turnPlayerId || null });
        setPlayers(data.players || {});

        // 남은 플레이어가 0명이면 방 상태를 대기(idle)로 변경
        const currentPlayers = data.players || {};
        if (Object.keys(currentPlayers).length === 0) {
           set(ref(db, `rooms/${roomId}/state`), 'idle');
        }
      } else {
        // 방 데이터 자체가 아예 없을 경우를 대비한 초기화
        setPlayers({});
      }
    });

    return () => {
      remove(playerRef);
      unsubscribe();
    };
  }, [roomId, myId, db]);

  // [2. SYSTEM 수동 초기화 기능]
  const systemResetRoom = () => {
    const roomRef = ref(db, `rooms/${roomId}`);
    set(roomRef, {
      state: 'idle',
      turnPlayerId: null,
      players: null 
    }).then(() => {
      console.log('SYSTEM: 방이 강제 초기화되었습니다.');
    });
  };

  // [새로운 기능] 특정 플레이어(또는 자기 자신) 추방 기능[cite: 1]
  const kickPlayer = (targetPlayerId) => {
    const targetPlayerRef = ref(db, `rooms/${roomId}/players/${targetPlayerId}`);
    // 데이터베이스에서 해당 플레이어의 데이터를 삭제하여 방에서 내보냅니다.
    remove(targetPlayerRef)
      .then(() => {
        console.log(`SYSTEM: 플레이어(${targetPlayerId})가 성공적으로 추방되었습니다.`);
      })
      .catch((error) => {
        console.error('추방 중 오류 발생:', error);
      });
  };

  return (
    <div>
      <h2>게임방: {roomId} (상태: {gameState.state})</h2>
      
      {/* SYSTEM 권한 버튼들 */}
      <div style={{ marginBottom: '20px' }}>
        <button onClick={systemResetRoom} style={{ background: 'black', color: 'red', marginRight: '10px' }}>
          [SYSTEM] 방 강제 초기화
        </button>
      </div>

      <hr />

      <div className="game-board">
        {Object.entries(players).map(([playerId, playerData]) => {
          const isMe = (playerId === myId);
          const isMyTurn = (gameState.turnPlayerId === playerId);
          
          // [3. 시각 효과] 실탄 여부에 따른 클래스
          const liveBullets = playerData.liveBullets || 0;
          const playerClass = isMe 
            ? 'my-player' 
            : `other-player ${liveBullets > 0 ? 'has-live-bullet' : ''}`;

          // [4. 총구 시점] 
          const gunImageUrl = isMe ? "/images/gun_front.png" : "/images/gun_back.png";

          return (
            <div key={playerId} className={playerClass} style={{ margin: '10px', padding: '10px', border: '1px solid #ccc' }}>
              <h3>{playerData.name} {isMe && '(나)'}</h3>
              <p>실탄: {liveBullets}발</p>
              
              {isMyTurn && (
                <div>
                  <img src={gunImageUrl} alt="총" width="100" />
                </div>
              )}

              {/* [시스템 전용] 해당 플레이어 강제 퇴장 버튼[cite: 1] */}
              <button 
                onClick={() => kickPlayer(playerId)} 
                style={{ background: 'darkred', color: 'white', marginTop: '10px' }}
              >
                {isMe ? '[SYSTEM] 내 캐릭터 빼기' : '[SYSTEM] 이 플레이어 추방'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GameRoom;
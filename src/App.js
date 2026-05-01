import React from 'react';
// 1번에서 만든 GameRoom 컴포넌트를 불러옵니다. (경로는 실제 위치에 맞게 수정)
import GameRoom from './components/GameRoom';
// CSS 파일도 잊지 말고 불러옵니다.
import './App.css'; 

function App() {
  // 실제 게임에서는 사용자가 로비에서 선택한 방 번호나 URL 파라미터가 들어가게 됩니다.
  const currentRoomId = "room-123"; 

  return (
    <div className="App">
      <h1>내 게임 로비</h1>
      
      {/* 게임방 컴포넌트를 렌더링하면서 방 번호를 전달합니다. */}
      <GameRoom roomId={currentRoomId} />
    </div>
  );
}

export default App;
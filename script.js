// 게임 설정 및 데이터
const GRID_SIZE = 5;
const MAX_ENERGY = 100;

// 아이템 정의 (이미지 사용: 폴더 내 파일명을 매핑, 없으면 이모지 대체)
const ITEMS = {
    moisture: [
        { level: 1, name: '물방울', icon: '💧', image: null },
        { level: 2, name: '스킨', icon: '🧴', image: 'images/토너-removebg-preview.png' }, // 대체: 스킨 이미지 미존재 → 토너 사용
        { level: 3, name: '크림', icon: '🥣', image: 'images/크림-removebg-preview.png' },
        { level: 4, name: '마스크팩', icon: '🎭', image: 'images/마스크팩-removebg-preview.png' },
        { level: 5, name: '앰플', icon: '🧪', image: 'images/앰플-removebg-preview.png' } // Max
    ],
    makeup: [
        { level: 1, name: '빨간가루', icon: '✨', image: null },
        { level: 2, name: '빨간물약', icon: '🍷', image: null },
        { level: 3, name: '틴트', icon: '💄', image: 'images/틴트-removebg-preview.png' },
        { level: 4, name: '립밤', icon: '💋', image: 'images/립밤-removebg-preview.png' },
        { level: 5, name: '립스틱', icon: '👄', image: 'images/립스틱-removebg-preview.png' } // Max
    ]
};

// 상태 변수
let state = {
    board: Array(GRID_SIZE * GRID_SIZE).fill(null), // null 또는 { type: 'moisture', level: 1 }
    energy: 50, // 초기 에너지
    points: 0,
    currentOrder: null,
    selectedIndex: null, // 터치/클릭용 선택 인덱스
    draggingIndex: null // 포인터 기반 드래그 폴백
};

// DOM 요소
const gridEl = document.getElementById('game-grid');
const energyEl = document.getElementById('energy-display');
const pointEl = document.getElementById('point-display');
const spawnerBtn = document.getElementById('spawner-box');
const orderTargetEl = document.getElementById('order-target');
const submitBtn = document.getElementById('submit-order-btn');

// --- 초기화 ---
function init() {
    renderBoard();
    updateStatus();
    generateOrder();
    
    // 이벤트 리스너
    spawnerBtn.addEventListener('click', spawnItem);
    submitBtn.addEventListener('click', submitOrder);
}

// --- 보드 렌더링 ---
function renderBoard() {
    gridEl.innerHTML = '';
    state.board.forEach((item, index) => {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        cell.dataset.index = index;

        // 드래그 드롭 이벤트 (터치/마우스 통합을 위해 심플하게 구현)
        cell.ondragenter = (e) => { e.preventDefault(); };
        cell.ondragover = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
        cell.ondrop = handleDrop;

        if (item) {
            const itemEl = document.createElement('div');
            itemEl.classList.add('item');
            itemEl.dataset.type = item.type;
            itemEl.draggable = true;
            
            // 아이템 시각화 (이미지 우선, 없으면 이모지)
            const itemData = ITEMS[item.type][item.level - 1];
            if (itemData.image) {
                const img = document.createElement('img');
                img.src = itemData.image;
                img.alt = itemData.name;
                img.draggable = false;
                itemEl.appendChild(img);
            } else {
                itemEl.textContent = itemData.icon;
            }
            
            // 드래그 시작 이벤트
            itemEl.ondragstart = (e) => {
                try {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', String(index));
                } catch {}
                e.target.style.opacity = '0.5';
            };
            itemEl.ondragend = (e) => {
                e.target.style.opacity = '1';
            };

            // 드롭 이벤트를 아이템에도 바인딩하여 가득 찬 칸에서도 동작하도록
            itemEl.ondragenter = (e) => { e.preventDefault(); };
            itemEl.ondragover = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
            itemEl.ondrop = handleDrop;

            // 터치/클릭 머지 지원: 같은 아이템을 선택 후 타겟 클릭 시 머지
            itemEl.onclick = () => handleTapMerge(index);

            // 포인터 기반 드래그 폴백 (마우스/터치 모두 지원)
            itemEl.onpointerdown = (e) => {
                state.draggingIndex = index;
                itemEl.setPointerCapture(e.pointerId);
            };
            itemEl.onpointerup = (e) => {
                if (state.draggingIndex === null) return;
                // 포인터가 놓인 위치의 셀을 찾음
                const el = document.elementFromPoint(e.clientX, e.clientY);
                const toCell = el ? el.closest('.cell') : null;
                if (!toCell) { state.draggingIndex = null; return; }
                const toIndex = parseInt(toCell.dataset.index);
                const fromIndex = state.draggingIndex;
                state.draggingIndex = null;
                performMergeOrMove(fromIndex, toIndex);
            };

            cell.appendChild(itemEl);
        }
        gridEl.appendChild(cell);
    });
    checkOrderAvailability();
}

// --- 아이템 생성 (Spawn) ---
function spawnItem() {
    if (state.energy <= 0) {
        alert("에너지가 부족합니다! (구매하거나 기다리세요)");
        return;
    }

    // 빈 칸 찾기
    const emptyIndices = state.board
        .map((item, index) => item === null ? index : -1)
        .filter(index => index !== -1);

    if (emptyIndices.length === 0) {
        alert("보드가 꽉 찼습니다! 아이템을 합쳐주세요.");
        return;
    }

    // 에너지 차감
    state.energy -= 1;
    updateStatus();

    // 랜덤 위치에 랜덤 아이템(Lv 1) 생성
    const randomIndex = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
    const randomType = Math.random() > 0.5 ? 'moisture' : 'makeup'; // 50:50 확률
    
    state.board[randomIndex] = { type: randomType, level: 1 };
    renderBoard();
}

// --- 머지 로직 (Drop) ---
function handleDrop(e) {
    e.preventDefault();
    const raw = e.dataTransfer ? e.dataTransfer.getData('text/plain') : null;
    const fromIndex = raw ? parseInt(raw) : state.selectedIndex;
    if (fromIndex === null || Number.isNaN(fromIndex)) return;
    // 드롭 대상이 아이템일 수도 있으므로 셀 요소를 안전하게 찾아 인덱스를 구한다
    const toCell = e.currentTarget.classList.contains('cell') ? e.currentTarget : e.currentTarget.closest('.cell');
    if (!toCell) return;
    const toIndex = parseInt(toCell.dataset.index);

    performMergeOrMove(fromIndex, toIndex);
}

// --- 터치/클릭 머지 ---
function handleTapMerge(targetIndex) {
    const currentItem = state.board[targetIndex];
    // 선택 없으면 선택 설정
    if (state.selectedIndex === null) {
        state.selectedIndex = targetIndex;
        highlightSelection(targetIndex);
        return;
    }

    const fromIndex = state.selectedIndex;
    if (fromIndex === targetIndex) {
        // 같은 칸 재클릭 시 선택 해제
        state.selectedIndex = null;
        renderBoard();
        return;
    }

    const fromItem = state.board[fromIndex];
    const toItem = state.board[targetIndex];

    // 빈 칸으로 이동
    if (!toItem) {
        state.board[targetIndex] = fromItem;
        state.board[fromIndex] = null;
        state.selectedIndex = null;
        renderBoard();
        return;
    }

    // 같은 타입/레벨 머지
    if (fromItem && toItem && fromItem.type === toItem.type && fromItem.level === toItem.level) {
        if (fromItem.level >= 5) {
            state.selectedIndex = null;
            renderBoard();
            return;
        }
        state.board[targetIndex] = { type: fromItem.type, level: fromItem.level + 1 };
        state.board[fromIndex] = null;
        state.selectedIndex = null;
        renderBoard();
        const targetCell = gridEl.children[targetIndex].querySelector('.item');
        if (targetCell) targetCell.classList.add('merging');
    } else {
        // 스왑
        state.board[targetIndex] = fromItem;
        state.board[fromIndex] = toItem;
        state.selectedIndex = null;
        renderBoard();
    }
}

function highlightSelection(index) {
    // 간단히 선택된 칸을 확대 효과로 표시
    const cellEl = gridEl.children[index];
    const itemEl = cellEl && cellEl.querySelector('.item');
    if (itemEl) itemEl.style.transform = 'scale(1.08)';
}

// 공통 병합/이동 로직
function performMergeOrMove(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
    const fromItem = state.board[fromIndex];
    const toItem = state.board[toIndex];
    if (!fromItem) return;

    // 빈 칸 이동
    if (!toItem) {
        state.board[toIndex] = fromItem;
        state.board[fromIndex] = null;
        renderBoard();
        return;
    }
    // 병합
    if (fromItem.type === toItem.type && fromItem.level === toItem.level) {
        if (fromItem.level >= 5) return;
        state.board[toIndex] = { type: fromItem.type, level: fromItem.level + 1 };
        state.board[fromIndex] = null;
        renderBoard();
        const targetCell = gridEl.children[toIndex].querySelector('.item');
        if (targetCell) targetCell.classList.add('merging');
        return;
    }
    // 스왑
    state.board[toIndex] = fromItem;
    state.board[fromIndex] = toItem;
    renderBoard();
}

// --- 주문(퀘스트) 시스템 ---
function generateOrder() {
    // 랜덤한 목표 생성 (Lv 2 ~ 4 사이)
    const types = ['moisture', 'makeup'];
    const type = types[Math.floor(Math.random() * types.length)];
    const level = Math.floor(Math.random() * 3) + 2; // Lv 2, 3, 4 중 하나

    state.currentOrder = { type, level };
    
    // UI 업데이트
    const targetData = ITEMS[type][level-1];
    if (targetData.image) {
        orderTargetEl.innerHTML = '';
        const img = document.createElement('img');
        img.src = targetData.image;
        img.alt = targetData.name;
        img.style.maxWidth = '100%';
        img.style.maxHeight = '100%';
        orderTargetEl.appendChild(img);
    } else {
        orderTargetEl.textContent = targetData.icon;
    }
    checkOrderAvailability();
}

function checkOrderAvailability() {
    if (!state.currentOrder) return;

    // 보드에 목표 아이템이 있는지 확인
    const hasItem = state.board.some(item => 
        item && item.type === state.currentOrder.type && item.level === state.currentOrder.level
    );

    if (hasItem) {
        submitBtn.disabled = false;
        submitBtn.classList.add('active');
        submitBtn.textContent = "납품 가능!";
    } else {
        submitBtn.disabled = true;
        submitBtn.classList.remove('active');
        submitBtn.textContent = "제작 중...";
    }
}

function submitOrder() {
    if (submitBtn.disabled) return;

    // 아이템 제거
    const targetIndex = state.board.findIndex(item => 
        item && item.type === state.currentOrder.type && item.level === state.currentOrder.level
    );

    if (targetIndex !== -1) {
        // 납품 성공!
        state.board[targetIndex] = null; // 아이템 소비
        state.points += 50; // 포인트 보상
        
        alert(`납품 완료! 50포인트를 획득했습니다.\n현재 포인트: ${state.points}`);
        
        updateStatus();
        renderBoard();
        generateOrder(); // 새 주문 생성
    }
}

// --- 유틸리티 ---
function updateStatus() {
    energyEl.innerText = `${state.energy}/${MAX_ENERGY}`;
    pointEl.innerText = state.points;
}

function closeModal() {
    document.getElementById('daily-modal').style.display = 'none';
    // 출석 보상 지급 처리
    state.energy = Math.min(state.energy + 50, MAX_ENERGY);
    updateStatus();
}

// 게임 시작
init();
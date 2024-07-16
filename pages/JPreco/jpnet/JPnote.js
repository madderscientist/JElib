import jsPic from './jsPic.js'

// 应该先运行JPnote.init()
export default class JPnote {
    constructor(numbox, semibox = [], dots = []) {  // 每个box:[x,y,w,h]
        this.num = numbox;
        this.semi = semibox;
        this.dots = dots;
        this.box = null;
    }
    hasSemi() {
        return this.semi[4] != void 0;
    }
    hasDots() {
        return this.dots?.length;
    }
    // 得到是图片的索引 1~12每个音符应该用什么数字和符号表示
    static notemap_up = [1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6, 7];
    static semimap_up = [-1, 8, -1, 8, -1, -1, 8, -1, 8, -1, 8, -1];
    static notemap_down = [1, 2, 2, 3, 3, 4, 5, 5, 6, 6, 7, 7];
    static semimap_down = [-1, 9, -1, 9, -1, -1, 9, -1, 9, -1, 9, -1];
    static notemap = JPnote.notemap_up;
    static semimap = JPnote.semimap_up;
    static switchMode(upMode = true) {
        if(upMode) {
            JPnote.notemap = JPnote.notemap_up;
            JPnote.semimap = JPnote.semimap_up;
        } else {
            JPnote.notemap = JPnote.notemap_down;
            JPnote.semimap = JPnote.semimap_down;
        }
    }
    // 得到的是在编码中的位置
    static note2id = [0, 2, 4, 5, 7, 9, 11];
    /**
     * 
     * @param {number} index this.note
     * @returns [note, semi, 八度]
     */
    static index2info(index) {
        let position = (index % 12 + 12) % 12;
        let k = Math.floor(index / 12);
        return [JPnote.notemap[position], JPnote.semimap[position], k];
    }
    static ignoreWhite(origin, cover) {
        if (cover[0] > 250 && cover[1] > 250 && cover[2] > 250) return origin;
        return cover;
    }
    /**
     * 从点集中匹配音高点
     * @param {Array<Array>} dots 点集
     * 以下参数用于二次提取时放宽标准
     * @param {number} Xmargin 在x方向上，点偏离数字中心的最大距离 如果是负数则为宽度的一半
     * @param {number} upperRatial 上方第一个点的搜索距离，与数字高度的比例
     * @param {number} lowerRatial 下方第一个点的搜索距离，与数字高度的比例
     * @param {number} refH 参考的高度（一般传递平均高度）。如果不传则为数字的高度
     */
    matchDots(dots, Xmargin = 1, upperRatial = 0.5, lowerRatial = 1, refH = 0) {   // 要求dots按照x坐标排序 会从dots中删去已经匹配的点
        if (Xmargin < 0) Xmargin = this.num[2] >> 1; // 宽度的一半，即只要x和dot有重合则认为是匹配的
        if (upperRatial <= 0) upperRatial = 0.5;
        if (lowerRatial <= 0) lowerRatial = 1;
        const xcenter = this.num[0] + (this.num[2] >> 1);
        const H = refH || this.num[3];
        const ybottom = this.num[1] + H;
        const found = [];
        // 用二分法找到第一个横坐标超过center的点
        let l = 0, r = dots.length - 1;
        while (l < r) {
            const mid = (l + r) >> 1;
            if (dots[mid][0] <= xcenter + Xmargin) l = mid + 1;
            else r = mid;
        }
        const xOK = [];
        for (l = l - 1; l >= 0 && dots[l][0] + dots[l][2] >= xcenter - Xmargin; l--) {
            xOK.push([dots[l][1] + (dots[l][3] >> 1) - ybottom, l]);    // 以数字下边缘为原点
        }
        xOK.sort((a, b) => a[0] - b[0]);    // 按y坐标排序
        // 找到第一个大于零的点
        for (l = 0; l < xOK.length && xOK[l][0] <= 0; l++);
        const addedId = [];     // 记录哪些被选中了，从dots中删除。必须先记录再删除，不然索引会乱
        // 先检查上面的
        r = l - 1;
        while (r >= 0 && xOK[r][0] + H > 0) r--;   // 略过在数字内的点
        let threshold = H * (1 + upperRatial) | 0;  // (1+0.5) 上边的点靠得普遍近 和数字上边缘的距离
        for (; r >= 0; r--) {
            if (xOK[r][0] + threshold >= 0) {
                const thedot = dots[xOK[r][1]];
                found.push(thedot);
                addedId.push(xOK[r][1]);
                threshold = H * 0.4 - xOK[r][0] | 0;
            } else break;
        }
        if (found.length == 0) {    // 如果上方没有找到则检查下面的
            threshold = Math.ceil(H * lowerRatial);      // 距离数字下边缘的距离
            for (r = l; r < xOK.length; r++) {
                if (xOK[r][0] <= threshold) {
                    const thedot = dots[xOK[r][1]];
                    found.push(thedot);
                    addedId.push(xOK[r][1]);
                    threshold = xOK[r][0] + H * 0.4 | 0;
                } else break;
            }
        }
        addedId.sort((a, b) => a - b);
        for (let i = addedId.length - 1; i >= 0; i--) {
            dots.splice(addedId[i], 1);
        }
        this.dots = found;
    }
    /**
     * 计算总体的包围盒，结果存放于this.box。并且自动填充semi(默认位置)
     * @returns {Array} 返回包围盒[x,y,w,h]
     */
    updateBox() {
        let [left, top, nw, nh] = this.num;
        let right = left + nw, bottom = top + nh;
        if (this.hasSemi()) {
            let [sx, sy, sw, sh] = this.semi;
            left = Math.min(left, sx);
            right = Math.max(right, sx + sw);
            top = Math.min(top, sy);
            bottom = Math.max(bottom, sy + sh);
        } else {    // 可以考虑所有的升降号全部用默认的位置
            let semiH = 0.8 * this.num[3] | 0;
            let semiW = 0.4 * semiH | 0;
            this.semi = [this.num[0] - semiW, this.num[1] - (semiH >> 1), semiW, semiH];
        }
        for (const box of this.dots) {
            left = Math.min(left, box[0]);
            right = Math.max(right, box[0] + box[2]);
            top = Math.min(top, box[1]);
            bottom = Math.max(bottom, box[1] + box[3]);
        }
        this.box = [left, top, right - left, bottom - top];
        return this.box;
    }
    /**
     * 从数字和升降号计算音高编码
     */
    updateNote() {
        let note = JPnote.note2id[this.num[4] - 1]; // 0 对应do
        // 升降号 不考虑还原号
        if (this.semi[4] == 8) note++;
        else if (this.semi[4] == 9) note--;
        let oct = 0;
        if (this.dots?.length) {
            if (this.dots[0][1] <= this.num[1]) oct = this.dots.length * 12;
            else oct = -this.dots.length * 12;
        }
        this.note = note + oct;
    }
    /**
     * 将音符的区域涂白
     * @param {jsPic} JSPIC 三通道的图
     */
    empty(JSPIC) {
        const pic1 = JSPIC.channel[0];
        const pic2 = JSPIC.channel[1];
        const pic3 = JSPIC.channel[2];
        const emptybox = (box) => {
            let [x, y, w, h] = box;
            w = x + w; h = y + h;
            while (y <= h) {
                const row1 = pic1[y];
                const row2 = pic2[y];
                const row3 = pic3[y];
                for (let i = x; i <= w; i++) {
                    row1[i] = 255;
                    row2[i] = 255;
                    row3[i] = 255;
                } y++;
            }
        }
        emptybox(this.num);
        if (this.hasSemi()) emptybox(this.semi);
        for (const box of this.dots) emptybox(box);
    }
    draw(JSPIC) {
        let [note, semi, oct] = JPnote.index2info(this.note);
        JSPIC.paste(this.num[0], this.num[1], JPnote.notePic[note].resize(-1, this.num[3]), JPnote.ignoreWhite);
        // semi的box在updateBox中赋值
        if (semi >= 0) JSPIC.paste(this.semi[0], this.semi[1], JPnote.notePic[semi].resize(-1, this.semi[3]), JPnote.ignoreWhite);
        // 绘制点
        if (oct == 0) return;
        let dotSize = Math.max(this.num[3] >> 2, 3);
        let dot = JPnote.notePic[11].resize(dotSize, dotSize);
        let startX = this.num[0] + ((this.num[2] - dotSize) >> 1);
        // 是oct大于0的配置，向上画
        let yoffset = -dotSize << 1;
        let step = -dotSize - (dotSize >> 1);
        if (oct < 0) {
            yoffset = this.num[3] + dotSize;
            step = -step;
            oct = -oct;
        }
        for (let y = this.num[1] + yoffset; oct > 0; oct--) {
            JSPIC.paste(startX, y, dot, JPnote.ignoreWhite);
            y += step;
        }
    }

    // 图片资源
    static notePic = [
        'notes/0.jpg',
        'notes/1.jpg',
        'notes/2.jpg',
        'notes/3.jpg',
        'notes/4.jpg',
        'notes/5.jpg',
        'notes/6.jpg',
        'notes/7.jpg',
        'notes/8.jpg',    // 升记号
        'notes/9.jpg',    // 降记号
        'notes/10.jpg',   // 还原
        'notes/11.jpg'    // 点
    ];
    static init(path2imgdata) {
        let promises = Array.from(JPnote.notePic, (path, id) => new Promise((resolve) => {
            path2imgdata(path).then((imgdata) => {
                resolve(new jsPic().fromImageData(imgdata, 'RGB'));
            });
        }));
        // 等到全部完成，返回jspic列表
        Promise.all(promises).then((arr) => {
            JPnote.notePic = arr;
            console.log("notes loaded");
        });
    }
}
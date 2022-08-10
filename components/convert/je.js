module.exports={
    Convert: Convert,
    simplified: simplified,
    findExtreme: findExtreme,
    indexToje: indexToje
}
var note = ["1", "#1", "2", "#2", "3", "4", "#4", "5", "#5", "6", "#6", "7"];

//主要函数，bef:要转换的内容；x:输入半音数目，正则升，负则降
function Convert(bef, x) {
    let aft = '';                 //转换后
    let n = 0;                    //位置
    let octave = 0;               //八度音高
    while (n < bef.length) {
        let m = 0;                //升降半音
        if (bef[n] == ')' || bef[n] == '[') ++octave;
        else if (bef[n] == '(' || bef[n] == ']') --octave;
        else {
            if (bef[n] == '#') m = 1;
            else if (bef[n] == 'b') m = -1;
            let position = note.indexOf(bef[n + Math.abs(m)]);      //在列表中的位置
            let N = 0;            //结果的位置
            let name = '';        //音名
            let pitch = 0;        //音高
            let brackets = '';    //括号
            if (position == -1) {
                m = 0;
                aft = aft + bef[n];
            }
            else {
                N = m + position + x;
                {
                    let p = (N % 12 + 12) % 12; //取N除12的模，不是余数！
                    name = note[p];
                }
                pitch = octave + Math.floor(N / 12);
                for (let i = 1; i <= Math.abs(pitch); i++) brackets = brackets + '[';
                aft = aft + ((pitch > 0) ? brackets : brackets.replace(/\[/g, '(')) + name + ((pitch > 0) ? brackets.replace(/\[/g, ']') : brackets.replace(/\[/g, ')'));
            }
        }
        n = n + Math.abs(m) + 1;
    }
    return aft;
}

//返回：content中有几个key
function countkey(content, key) {
    return content.length - content.replace(new RegExp(key, "gm"), '').length;
}

//一键最简（#最少）
function simplified(bef) {
    let downtimes = 0;
    let aft = '';
    aft = Convert(bef, 0);
    let amount = countkey(aft, '#');
    let min = amount;
    for (let i = 1; i < 12; i++) {
        aft = Convert(aft, -1);
        amount = countkey(aft, '#');
        if (amount < min) {
            min = amount;
            downtimes = i;
            if (min == 0) break;
        }
    }
    wx.showToast({
      title: "降" + downtimes + "调，最少" + min + "个“#”",
      icon: "none"
    })
    return Convert(bef, -downtimes);
}

//找到极值音，返回序号（[最低，最高]）
function findExtreme(content) {
    let len = content.length;
    let octave = 0;
    let lowest = 0.1;
    let highest = 0.1;
    let n = 0;
    while (n < len) {
        while (n < len) {   //检测括号，判断八度
            if (content[n] == "[" || content[n] == ")") octave += 12;
            else if (content[n] == "]" || content[n] == "(") octave -= 12;
            else break;
            n++;
        }
        if (n < len) {
            let up = 0;       //半音关系
            if (content[n] == "#") up = 1;
            else if (content[n] == "b") up = -1;
            let N = n + Math.abs(up);
            if (N < len) {
                let position = note.indexOf(content[N]);
                if (position < 0) n++;    //不在表格里
                else {
                    position = position + up + octave;
                    if (position < lowest || lowest == 0.1) lowest = position;
                    if (position > highest || highest == 0.1) highest = position;
                    n = N + 1;
                }
            }
            else break; //就是结束了，或者#后面没有东西了
        }
    }
    return [lowest, highest];
}

//把序号转换为je音符，0-->1
function indexToje(index) {
    let position = (index % 12 + 12) % 12;
    let k = Math.floor(index / 12);
    let brackets = '';
    for (let i = 0; i < Math.abs(k); i++) {
        brackets = brackets + '[';
    }
    return ((k > 0) ? brackets : brackets.replace(/\[/g, '(')) + note[position] + ((k > 0) ? brackets.replace(/\[/g, ']') : brackets.replace(/\[/g, ')'));
}
import { Convert, findExtreme, indexToje, simplified } from "./je.js";
var mode = 0;
var num = 1;
var befText = "";
var aftText = "";
var fromTone = 0;
var toTone = 0;
var extremeMode = 0;
var extreme = '(1)';
var lowest = 0;
var highest = 0;

Component({
  properties: {
    pu:{
      type: String,
      value: ""
    }
  },
  data: {
    lowestTone: "1",
    highestTone: "1",
  },
  methods: {
    inputHandler(e){this.setData({pu: e.detail.value})},
    bef(e){befText=e.detail.value},
    aft(e){aftText=e.detail.value},
    Mode(e){mode=e.detail.id},
    Num(e){num=e.detail.id + 1},
    from(e){fromTone=e.detail.id},
    to(e){toTone=e.detail.id},
    extremeMode(e){extremeMode=e.detail.id},
    extreme(e){extreme=e.detail.value},
    replace(){this.setData({pu: this.data.pu.replace(new RegExp(befText,'g'),aftText)})},
    convertByNum(){
      let x=mode?-num:num;
      this.setData({
        pu: Convert(this.data.pu,x)
      })
    },
    convertByTone(){
      var x = fromTone - toTone;
      if (x < -5.5) x += 12;
      else if (x > 6.5) x = x - 12;
      this.setData({
        pu: Convert(this.data.pu,x)
      })
    },
    extremeTone(){
      extreme=extreme.replace(/（/,"(").replace(/）/,")").replace(/ /,"").replace(/【/,"[").replace(/】/,"]");
      var target=findExtreme(extreme)[extremeMode];
      this.setData({
        pu: Convert(this.data.pu, target-(extremeMode?highest:lowest))
      })
    },
    extremeShow(){
      [lowest,highest]=findExtreme(this.data.pu);
      this.setData({
        lowestTone: lowest==0.1?"???":indexToje(lowest),
        highestTone: highest==0.1?"???":indexToje(highest)
      })
    },
    simp(){this.setData({pu: simplified(this.data.pu)})},
    upC(){
      var x = Convert(this.data.pu, -1);
      var a = ['#1', '#2', '#4', '#5', '#6'];
      var b = ['b2', 'b3', 'b5', 'b6', 'b7'];
      for (let i = 0; i < 5; i++)
        x = x.replace(new RegExp(a[i], 'gm'), b[i]);
      this.setData({
        pu: x
      })
    },
    up3(){
      this.setData({
        pu: this.data.pu
          .replace(/#4/g, "ᗢ")
          .replace(/4/g, "#3")
          .replace(/ᗢ/g, "#4")
          .replace(/\[\(/g, '')
          .replace(/\)\]/g, '')
      })
    },
    up7(){
      this.setData({
        pu: this.data.pu
          .replace(/#1/g, "ᗢ")
          .replace(/1/g, "(#7)")
          .replace(/ᗢ/g, "#1")
          .replace(/\[\(/g, '')
          .replace(/\)\]/g, '')
      })
    }
  },
  observers:{
    'pu': function(value){this.extremeShow()}
  }
})

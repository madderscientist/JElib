const parser = require('./parser');
var selectedItem = null;    // 选中的数据项

Component({
  properties: {
    // 不可alreadydata和md同时有值。此为未定义事件
    alreadyData: {
      type: Object,
      value: null,
      observer(){
        if(this.data.alreadyData)
          this.setData({
            parsedData: this.data.alreadyData
          });
      }
    },
    md: {
      type: String,
      value: '',
      observer() {
        if(this.data.md)
          this.parseMd();
      }
    },
    type: {
      type: String,
      value: 'wemark'
    },
    link: {
      type: Boolean,
      value: false
    },
    highlight: {
      type: Boolean,
      value: false
    }
  },
  data: {
    parsedData: {}
  },
  methods: {
    parseMd() {
      if (this.data.md) {
        var parsedData = parser.parse(this.data.md, {
          link: this.data.link,
          highlight: this.data.highlight
        });
        if (this.data.type === 'wemark')
          this.setData({parsedData});
      }
    },
    wemarkTabImage(e){        // 点击图片则放大
      wx.previewImage({
        current: e.currentTarget.dataset.src, // 当前显示图片的http链接
        urls: [e.currentTarget.dataset.src] // 需要预览的图片http链接列表
      })
    },
    select(e){
      selectedItem = this.data.parsedData[e.currentTarget.dataset.id];
      if(selectedItem.isArray && selectedItem.content[0].type!="text"){
        selectedItem=null;
        return;
      }
      this.triggerEvent(
        "sendDataUp",
        selectedItem.isArray?selectedItem.content[0].content:selectedItem.content);
    },
    // 改变长按选中项内容
    changeSelected(newContent){
      if(!selectedItem) return;
      if(selectedItem.isArray) selectedItem=selectedItem.content[0];
      selectedItem.content = newContent;
      // 更新parsedData以更新展示的数据
      this.setData({parsedData: this.data.parsedData});
    }
  }
});

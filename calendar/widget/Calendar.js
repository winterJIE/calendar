/**
 * Component: Calendar
 * User: cdlijie3
 * Date: 14-03-09
 * Time: 18:00
 * 部分代码参考拔赤大大写的kissy组件calendar
 */
 define('widget.Calendar', [] ,function(require, exports, module){

	var Calendar = panda.object.create();
	module.exports = panda.object.extend(Calendar, panda.widget.base, {
		uiType : 'Calendar',
		options : {
			target : null,
            skin:"default",
            date: new Date(), //该日期所在月份, 默认为当天
            selected: null, //当前选中的日期
            startDay: 0,//日历显示星期x为起始日期, 取值范围为0到6, 默认为0,从星期日开始,若取值为1, 则从星期一开始, 若取值为7, 则从周日开始
            pages: 2, //日历的页数, 默认为1, 包含一页日历
            closable: false, //在弹出情况下, 点选日期后是否关闭日历, 默认为false
            rangeSelect: false, //是否支持时间段选择，只有开启时候才会触发rangeSelect事件
            minDate: false, //日历可选择的最小日期
            maxDate: false, //日历可选择的最大日期
            navigator: true, //是否可以通过点击导航输入日期,默认开启
            popup: false, //日历是否为弹出,默认为false
            showTime: false, //是否显示时间的选择,默认为false
            triggerType: ['click'], //弹出状态下, 触发弹出日历的事件, 例如：[‘click’,’focus’],也可以直接传入’focus’, 默认为[‘click’]
            disabled: null, //禁止点击的日期数组[new Date(),new Date(2011,11,26)]
            range: null, //已选择的时间段{start:null,end:null}
            rangeLinkage: true, //多个日历是否联动
            align: {
                points: ['bl', 'tl'],
                offset: [0, 0]
            } //对齐方式

		},
		init : function(opts){
            this.options = panda.object.parameter(opts, this.options);
            this.options = this.options || {};
            this._parseParam(self.options);
            this.id = this._stamp(this.options.target);
            this.EVENTS = {
                HIDE:"onhide",
                SHOW:"onshow",
                MOUSECHANGE:"mousechange",
                SELECT:"select",
                RANGESELECT:"rangeSelect",
                YEARCHANGE:"yearChange",
                SELECTTIME:"selectTime"

            };
            if(!this.options.popup){
                this.con = this.options.target;
            }else{
                this.trigger = this.options.target;
                var template = panda.util.template.create(
                    '<div class="pw-popup-calendar">'+'</div>'
                );

                var tpl = template.expand({});
                panda(document.body).append(tpl);

                this.con = panda(".pw-popup-calendar");
                this.con.css({
                    'top':0,
                    'position':"absolute",
                    'background':"white",
                    'visibility':"hidden",
                    'zIndex':9999999
                });
            }

            this.C_Id = this._stamp(this.con);

            this._render();
            this._buildEvent();
            return this;

		},

        _render: function(o){
            var self = this, i = 0, _prev, _next, _oym;
            o = o || {};
            self._parseParam(o);

            self.con.addClass('ks-cal-call ks-clearfix ks-cal-call-multi-' + self.options.pages);

            self.ca = self.ca || [];

            for(var i = 0; i < self.ca.length; i++ ){
                for(var j = 0; j < self.ca[i].EV.length; j++){

                    self.ca[i].EV[j].target.unbind(self.ca[i].EV[j].type);
                }
            }
            if(self._shimE1){
                self._shimE1.remove();
                delete self._shimE1;
            }

            self.con.empty();

            self.ca.length = self.options.pages;
            var _rangeStart = false;
            var _rangeEnd = false;

            if(self.options.range) {
                if(self.options.range.start){
                    _rangeStart = true;
                }
                if(self.options.range.end){
                    _rangeEnd = true;
                }
            }

            if(_rangeStart && !self.options.rangeLinkage){
                _oym = [self.options.range.start.getFullYear(), self.options.range.start.getMonth()];
            }else{
                _oym = [self.year, self.month];
            }

            for (i = 0; i < self.options.pages; i++) {

                if (i === 0) {
                    if (_rangeStart) {
                        self._time = panda.object.copy(self.options.range.start);
                    }
                    _prev = true;

                } else if (!self.options.rangeLinkage) {

                    if (_rangeEnd) {
                        self._time = panda.object.copy(self.options.range.end);
                    }

                    _prev = true;

                    if (_rangeEnd && (i + 1) == self.options.pages) {
                        _oym = [self.options.range.end.getFullYear(), self.options.range.end.getMonth()];
                    } else {
                        _oym = self._computeNextMonth(_oym);
                    }

                } else {

                    if (_rangeEnd) {
                        self._time = panda.object.copy(self.options.range.end);
                    }
                    _prev = false;
                    _oym = self._computeNextMonth(_oym);

                }

                if (!self.options.rangeLinkage) {

                    _next = true;

                } else {

                    _next = i == (self.options.pages - 1);

                }

                var cal = self.ca[i];

                if (!self.options.rangeLinkage && cal && (cal.year != _oym[0] || cal.month != _oym[1])) {

                    _oym = [cal.year, cal.month];

                }

                self.ca[i] = new self.page({
                    year: _oym[0],
                    month: _oym[1],
                    prevArrow: _prev,
                    nextArrow: _next,
                    showTime: self.showTime
                }, self);
                self.ca[i].render();
            }
            if (self.popup && panda.browser.version() === 6) {
                self.__shimEl = new Node("<" + "iframe frameBorder='0' style='position: absolute;" +
                    "border: none;" +
                    "width: expression(this.parentNode.offsetWidth-3);" +
                    "top: 0;" +
                    "left: 0;" +
                    "z-index: 0;" +
                    "height: expression(this.parentNode.offsetHeight-3);" + "'></iframe>");
                self.con.prepend(self.__shimEl);
            }
            return this;
        },

        _buildEvent: function(){

            var self = this, tev, i;
            if(!self.options.popup){
                return this;
            }
            panda.each(self.EV, function(tev){
                if(tev){
                    tev.target.detach(tev.type, tev.fn);
                }
            });
            self.EV = self.EV || [];
            tev = self.EV[0] = {
                target: panda(document),
                type : 'click'
            };
            tev.fn = function(e){
                var target = panda(e.target || e.srcElement);
                if(target.attr('id') === self.C_Id){
                    return;
                }
                if((target.hasClass("ks-next")) || target.hasClass('ks-prev') && target[0].tagName === 'A'){
                    return;
                }

                if(target.attr('id') == self.id){
                    return;
                }

                if(self.con.css('visibility') == 'hidden'){
                    return;
                }

                var inRegion = function(dot, r){
                    return dot[0] > r[0].x && dot[0] < r[1].x && dot[1] > r[0].y && dot[1] < r[1].y;
                }

                if(!inRegion([e.pageX, e.pageY],
                    [
                        {
                            x:self.con.position().x,
                            y:self.con.position().y
                        },
                        {
                            x:self.con.position().x + self.con.width(),
                            y:self.con.position().y + self.con.height()
                        }
                    ]
                )){
                    self.hide();
                }

            };
            tev.target.on(tev.type, tev.fn);

            for(i = 0; i < self.options.triggerType.length; i++){
                tev = self.EV[i + 1] = {
                    target: panda("#"+ self.id +""),
                    type: self.options.triggerType[i],
                    fn: function(e){
                        e.target = panda(e.target);
                        e.preventDefault();

                        var a = self.options.triggerType;
                        if(a.indexOf('click') != -1 && a.indexOf('focus') != -1){
                            if(e.type == 'focus'){
                                self.toggle();
                            }
                        }else if(a.indexOf('click') != -1 && a.indexOf('focus') == -1){
                            if(e.type == 'click'){
                                self.toggle();
                            }
                        }else if(a.indexOf('click') == -1 && a.indexOf('focus') != -1 ){
                            setTimeout(function(){
                                self.toggle();
                            }, 170);
                        }else{
                            self.toggle();
                        }
                    }
                };
                tev.target.on(tev.type, tev.fn);
            }
            return this;
        },

        //改变日历显示状态
        toggle: function(){
            var self = this;
            if(self.con.css('visibility') == 'hidden'){
                self.show();
            }else{
                self.hide();
            }
        },
        //显示日历
        show: function(){
            var self = this;
            self.con.css('visibility', '');
            var points = self.options.align.points,
                offset = self.options.align.offset || [0, 0],
                xy = self.con.position(),
                p1 = self._getAlignOffset(self.trigger, points[0]),
                p2 = self._getAlignOffset(self.con, points[1]),
                diff = [p2.left - p1.left, p2.top - p1.top],
                _x = xy.x - diff[0] + offset[0],
                _y = xy.y - diff[1] + offset[1];

            self.con.css({
                'top': _y.toString(),
                'left': _x.toString()
            });
            panda(self).trigger(self.EVENTS.SHOW,{data:"显示日历回调成功！"});
            //显示日历的回调
            return this;


        },
        //隐藏日历
        hide: function(){
            var self = this;
            self.con.css('visibility', 'hidden');

            panda(self).trigger(self.EVENTS.HIDE,{data:"隐藏日历回调成功！"});
            //隐藏日历的回调！
            return this;

        },
        //处理对齐
        _getAlignOffset: function(node, align){
            var V = align.charAt(0),
                H = align.charAt(1),
                offset, w, h, x, y;

            if (node) {
                node = panda(node);
                offset = node.position();
                w = node.outerWidth();
                h = node.outerHeight();
            } else {
                offset = { left: DOM.scrollLeft(), top: DOM.scrollTop() };
                w = DOM.viewportWidth();
                h = DOM.viewportHeight();
            }

            x = offset.x;
            y = offset.y;

            if (V === 'c') {
                y += h / 2;
            } else if (V === 'b') {
                y += h;
            }

            if (H === 'c') {
                x += w / 2;
            } else if (H === 'r') {
                x += w;
            }

            return { left: x, top: y };

        },

        destory: function(){
            var self = this;
            for(var i = 0; i < self.ca.length; i++){
                self.ca[i].detachEvent();
            }
            panda.each(self.EV, function(tev){
               if(tev){
                   tev.target.detach(tev.type, tev.fn);
               }
            });
            self.con.remove();
        },

        _computeNextMonth: function (a) {
            var _year = a[0],
                _month = a[1];
            if (_month == 11) {
                _year++;
                _month = 0;
            } else {
                _month++;
            }
            return [_year, _month];
        },


        _stamp:function(elem){
            if(!elem.attr("id")){
                elem.attr("id", "pw_calendar_"+panda.util.guid());
            }
            return elem.attr("id");

        },

        _parseParam:function(o){
            var self = this, i;
            if(o === undefined || o === null){
                o = {};
            }

            for(i in o){
                self.options[i] = o[i];
            }

            if(typeof self.options.triggerType === 'string'){
                self.triggerType = [self.options.triggerType];
            }

            self.options.startDay = self.options.startDay % 7;
            if(self.options.startDay < 0){
                self.options.startDay += 7;
            }

            if(!(self.options.target instanceof panda)){
                self.options.target = panda(self.options.target);
            }

            self.EV = [];
            self._handleDate();
            if(self.options.multiSelect){
                self.options.rangeSelect = false;
                self.options.range = null;
                self.options.selected = null;
            }
        },

        //处理起始日期 d:date类型
        _handleRange: function(d){
            var self = this, t;
            self.options.range = self.options.range || {start:null, end:null};
            if((self.options.range.start == null && self.options.range.end == null) || (self.options.range.start !== null && self.options.range.end !== null)){
                self.options.range.start = d;
                self.options.range.end = null
            } else if(self.options.range.start !== null && self.options.range.end == null){
                self.options.range.end = d;
                if(self.options.range.start.getTime() > self.options.range.end.getTime()){
                    t = self.options.range.start;
                    self.options.range.start = self.options.range.end;
                    self.options.range.end = t;
                }
                //选择日期rangeSelect回调

                panda(self).trigger(self.EVENTS.RANGESELECT, self.options.range);
                if( self.options.popup && self.options.closable ){
                    self.hide();
                }
            }
            return this;
        },

        _handleOffset: function () {
            var self = this,
                data = ['日', '一', '二', '三', '四', '五', '六'],
                temp = panda.util.template.create(
                    '<span>{day}</span>'
                ),
                offset = self.options.startDay,
                a = [];
            for (var i = 0; i < 7; i++) {
                a[i] = [
                    data[(i + offset) % 7]
                    ];
            }
            var tpl = "";
            for(var j = 0; j < 7; j++) {
                tpl += temp.expand({
                    day:a[j]
                });
            }
            return tpl;
        },

        /**
         * 处理日期
         * @method _handleDate
         * @private
         */
        _handleDate: function () {
            var self = this,
                date = self.options.date;
            self.weekday = date.getDay() + 1;//星期几 //指定日期是星期几
            self.day = date.getDate();//几号
            self.month = date.getMonth();//月份
            self.year = date.getFullYear();//年份
            return this;
        },

        //get标题
        _getHeadStr: function (year, month) {
            return year.toString() + '年' + (Number(month) + 1).toString() + '月';
        },

        //月加
        _monthAdd: function () {
            var self = this;
            if (self.month == 11) {
                self.year++;
                self.month = 0;
            } else {
                self.month++;
            }
            self.options.date = new Date(self.year.toString() + '/' + (self.month + 1).toString() + '/1');
            return this;
        },

        //月减
        _monthMinus: function () {
            var self = this;
            if (self.month === 0) {
                self.year--;
                self.month = 11;
            } else {
                self.month--;
            }
            self.options.date = new Date(self.year.toString() + '/' + (self.month + 1).toString() + '/1');
            return this;
        },
        //年加
        _yearAdd: function () {
            var self = this;
            self.year++;
            self.options.date = new Date(self.year.toString() + '/' + (self.month + 1).toString() + '/1');
            return this;
        },

        //年减
        _yearMinus: function () {
            var self = this;
            self.year--;
            self.options.date = new Date(self.year.toString() + '/' + (self.month + 1).toString() + '/1');
            return this;
        },

        page: function(config, father){
         /**
          * 子日历构造器
          * @constructor S.Calendar.Page
          * @param {Object} config ,参数列表，需要指定子日历所需的年月
          * @param {Object} father,指向Y.Calendar实例的指针，需要共享父框的参数
          * @return 子日历的实例
          */
             //属性
         this.father = father;

         this.father.dt_date = this.father.options.date;
         this.month = Number(config.month);
         this.year = Number(config.year);
         this.prevArrow = config.prevArrow;
         this.nextArrow = config.nextArrow;
         this.node = null;
         this.timmer = null;//时间选择的实例
         this.id = '';
         this.templateCalendar = panda.util.template.create(
                '<div class="pw-skin-{skin}">'+
                    '<div class="pw-calendar ks-cal-box" id="{guid}" pwjs="pw-calendar">'+
                        '<div class="ks-cal-hd" pwjs="pw-cal-hd">'+
                            '<a href="javascript:void(0);" class="ks-prev-year"> &lt; </a>'+
                            '<a href="javascript:void(0);" class="ks-prev-month"> &lt; </a>'+
                            '<a href="javascript:void(0);" class="ks-title"> {yearAndMouth} </a>'+
                            '<a href="javascript:void(0);" class="ks-next-month"> &gt; </a>'+
                            '<a href="javascript:void(0);" class="ks-next-year"> &gt; </a>'+
                        '</div>'+
                        '<div class="ks-cal-bd" pwjs="pw-cal-bd">'+
                            '<div class="ks-whd" pwjs="pw-cal-bd-whd">{weekday}</div>'+
                            '<div class="ks-dbd ks-clearfix">{days}</div>'+
                        '</div>'+
                        '<div class="ks-setime hidden">'+
                        '</div>'+
                        '<div class="{notlimited}"><a href="#" class="ks-cal-notLimited {notlimitedCls}">不限</a></div>'+
                        '<div class="ks-multi-select {multiSelect}"><button class="ks-multi-select-btn">确定</button></div>'+
                        '<div class="ks-cal-ft {showtime}">'+
                        '<div class="ks-cal-time">'+
                        '时间：00:00 {hearts}'+
                        '</div>'+
                        '</div>'+
                        '<div class="ks-selectime hidden">'+ //<!--用以存放点选时间的一些关键值-->',
                        '</div>'+
                        '</div><!--#ks-cal-box-->'+
                   '</div>'+
                '</div>'+
                '</div>'+
                '</div>'
            );

         this.template_nav_html = panda.util.template.create([
             '<p>',
             '月',
             '<select' +
                 ' value="{the_month}">',
             '<option class="m1" value="1">01</option>',
             '<option class="m2" value="2">02</option>',
             '<option class="m3" value="3">03</option>',
             '<option class="m4" value="4">04</option>',
             '<option class="m5" value="5">05</option>',
             '<option class="m6" value="6">06</option>',
             '<option class="m7" value="7">07</option>',
             '<option class="m8" value="8">08</option>',
             '<option class="m9" value="9">09</option>',
             '<option class="m10" value="10">10</option>',
             '<option class="m11" value="11">11</option>',
             '<option class="m12" value="12">12</option>',
             '</select>',
             '</p>',
             '<p>',
             '年',
             '<input type="text" value="{the_year}" onfocus="this.select()"/>',
             '</p>',
             '<p>',
             '<button class="ok">确定</button><button class="cancel">取消</button>',
             '</p>'
         ].join(""));

         this.Verify = function () {

             var isDay = function (n) {
                     if (!/^\d+$/i.test(n)) {
                         return false;
                     }
                     n = Number(n);
                     return !(n < 1 || n > 31);

                 },
                 isYear = function (n) {
                     if (!/^\d+$/i.test(n)) {
                         return false;
                     }
                     n = Number(n);
                     return !(n < 100 || n > 10000);

                 },
                 isMonth = function (n) {
                     if (!/^\d+$/i.test(n)) {
                         return false;
                     }
                     n = Number(n);
                     return !(n < 1 || n > 12);


                 };

             return {
                 isDay:isDay,
                 isYear:isYear,
                 isMonth:isMonth

             };


         };

         this._renderUI = function () {
             var cc = this, _o = {}, ft;
             cc.HTML = '';
             _o.prev = '';
             _o.next = '';
             _o.title = '';
             _o.ds = '';
             _o.notlimited = '';
             _o.notlimitedClass = '';
             if (!cc.prevArrow) {
                 _o.prev = 'hidden';
             }
             if (!cc.nextArrow) {
                 _o.next = 'hidden';
             }
             if (!cc.father.options.showTime) {
                 _o.showtime = 'hidden';
             }
             if (!cc.father.options.notLimited) {
                 _o.notlimited = 'hidden';
             }
             if (!cc.father.options.multiSelect) {
                 _o.multiSelect = 'hidden';
             }
             if (cc.father.options.showTime && cc.father.options.notLimited) {
                 _o.notlimitedCls = 'pw-cal-notLimited-showTime';
             }
             if (cc.father.options.notLimited && !cc.father.options.selected) {
                 _o.notlimitedCls += ' ks-cal-notLimited-selected';
             }
             _o.id = cc.id = 'ks-cal-' + Math.random().toString().replace(/.\./i, '');
             _o.title = cc.father._getHeadStr(cc.year, cc.month);
             cc.createDS();
             _o.ds = cc.ds;

             var tpl = cc._generateTpl(_o);

             cc.father.con.append(tpl);
             cc.node = panda("#"+cc.id+"");
             if (cc.father.options.showTime) {
                 ft = cc.node.find('.ks-cal-ft');
                 cc.timmer = new cc.father.TimeSelector(ft, cc.father);
             }
             return this;
         };
         this._generateTpl = function(_o){
            var self = this;
            var weekday = self.father._handleOffset();
            var tpl = self.templateCalendar.expand({
                skin:self.father.options.skin,
                yearAndMouth: _o.title,
                guid: _o.id,
                weekday: weekday,
                days: _o.ds,
                notlimited: _o.notlimited,
                notlimitedCls: _o.notlimitedCls,
                multiSelect: _o.multiSelect,
                showtime: _o.showtime
            });
            return tpl;
        };
         /**
             * 生成日期的html
             *
             */
         this.createDS = function () {
            var cc = this,
                s = '',
                startOffset = (7 - cc.father.options.startDay + new Date(cc.year + '/' + (cc.month + 1) + '/01').getDay()) % 7, //当月第一天是星期几
                days = cc._getNumOfDays(cc.year, cc.month + 1),//算出本月有多少天
                selected = cc.father.options.selected,
                today = new Date(),
                i, _td_s;

            for (var i = 0; i < startOffset; i++) {
                s += '<a href="javascript:void(0);" class="ks-null">0</a>';
            }
            //左莫优化了日历生成
            for (i = 1; i <= days; i++) {
                var cls = '';
                var date = new Date(cc.year, cc.month, i);
                //minDate 和 maxDate都包含当天
                if ((cc.father.options.minDate && new Date(cc.year, cc.month, i + 1) <= cc.father.options.minDate) || (cc.father.options.maxDate && date > cc.father.options.maxDate) || cc._isDisabled(cc.father.options.disabled, date)) {
                    cls = 'ks-disabled';
                }
                else if (cc.father.options.range && date >= cc.father.options.range.start && date <= cc.father.options.range.end) {
                    cls = 'ks-range';
                }
                else if ((selected && selected.getFullYear() == cc.year && selected.getMonth() == cc.month && selected.getDate() == i) || cc.isInMulit(cc.father.options.multi, date)) {
                    cls = 'ks-selected';
                }

                if (today.getFullYear() == cc.year && today.getMonth() == cc.month && today.getDate() == i) {
                    cls += ' ks-today';
                }

                s += '<a ' + 'class="'+ cls +'"' + ' href="javascript:void(0);">' + i + '</a>';
            }
            cc.ds = s;
            return this;
        };

         /*
         * 得到某月有多少天，需要给定年来判断闰年
         * */
         this._getNumOfDays = function(year, month){

             return 32 - new Date(year, month-1, 32).getDate();

         };

         this._isDisabled = function(arrDisabled, date){
             if(arrDisabled && arrDisabled.length > 0){
                 for(var i = 0; i < arrDisabled.length; i++ ){
                     var d = arrDisabled[i];
                     if(date.getFullYear() == d.getFullYear() && date.getMonth() == d.getMonth() && date.getDate() == d.getDate()){
                         return true;
                     }
                 }
             }
             return false;
         };

         this.isInMulit = function(mulit, date){
             if (mulit && mulit.length > 0) {
                for (var i = 0; i < mulit.length; i++) {
                    var arr = mulit[i].split('-');
                    if (date.getFullYear() == parseInt(arr[0], 10) && date.getMonth() == (parseInt(arr[1], 10) - 1) && date.getDate() == parseInt(arr[2], 10)) {
                        return true;
                    }
                }
            }
            return false;
         };

         this._buildEvent = function(){
             var cc = this, i, tev,
                 con = panda("#"+cc.id+"");
             function bindEventTev(){
                 tev.target.on(tev.type, tev.fn);
             }

             cc.EV = [];
             if(!cc.father.options.multiSelect){
                 tev = cc.EV[cc.EV.length] = {
                     target:con.find("div.ks-dbd"),
                     type:"click",
                     fn:function(e){
                         e.preventDefault();
                         if(e.target.tagName != "A"){
                             return;
                         }
                         e.target = panda(e.target);
                         if(e.target.hasClass("ks-null")){
                             return;
                         }
                         if(e.target.hasClass("ks-disabled")){
                             return;
                         }
                         var d = new Date(cc.year, cc.month, Number(e.target.html()));
                         cc.father.dt_date = d;
                         panda(cc.father).trigger(cc.father.EVENTS.SELECT, d);
                         if(cc.father.options.popup && cc.father.options.closable && !cc.father.options.showTime && !cc.father.options.rangeSelect){
                             cc.father.hide();
                         }
                         if(cc.father.options.rangeSelect){
                             if(cc.timmer){
                                 d.setHours(cc.timer.get('h'));
                                 d.setMinutes(cc.timmer.get('m'));
                                 d.setSeconds(cc.timmer.get('s'));
                             }
                             cc.father._handleRange(d);
                         }
                         cc.father._render({selected:d});
                     }
                 };
                 bindEventTev();
             }

             tev = cc.EV[cc.EV.length] = {
                    target:con.find('a.ks-prev-month'),
                    type:'click',
                    fn:function (e) {
                        e.preventDefault();
                        if (!cc.father.options.rangeLinkage) {
                            cc._monthMinus();
                        }
                        cc.father._monthMinus()._render();
                        panda(cc.father).trigger(cc.father.MOUSECHANGE,
                            new Date(cc.father.year + '/' + (cc.father.month + 1) + '/01')
                        );
                    }
                };
                bindEventTev();
                //向后一月
                tev = cc.EV[cc.EV.length] = {
                    target:con.find('a.ks-next-month'),
                    type:'click',
                    fn:function (e) {
                        e.preventDefault();
                        if (!cc.father.options.rangeLinkage) {
                            cc._monthAdd();
                        }
                        cc.father._monthAdd()._render();
                        panda(cc.father).fire(cc.father.EVENTS.MOUSECHANGE, new Date(cc.father.year + '/' + (cc.father.month + 1) + '/01'));
                    }
                };
                bindEventTev();
                //向前一年
                tev = cc.EV[cc.EV.length] = {
                    target:con.find('a.ks-prev-year'),
                    type:'click',
                    fn:function (e) {
                        e.preventDefault();
                        if (!cc.father.options.rangeLinkage) {
                            cc._yearMinus();
                        }
                        cc.father._yearMinus()._render();
                        panda(cc.father).trigger(cc.father.EVENTS.YEARCHANGE, new Date((cc.father.year - 1) + '/' + cc.father.month + '/01'));
                    }
                };
                bindEventTev();
                //向后一年
                tev = cc.EV[cc.EV.length] = {
                    target:con.find('a.ks-next-year'),
                    type:'click',
                    fn:function (e) {
                        e.preventDefault();
                        if (!cc.father.options.rangeLinkage) {
                            cc._yearAdd();
                        }
                        cc.father._yearAdd()._render();
                        panda(cc.father).trigger(cc.father.EVENTS.YEARCHANGE,
                            new Date((cc.father.year + 1) + '/' + cc.father.month + '/01'));
                    }
                };
                bindEventTev();
             if (cc.father.options.navigator) {
                    tev = cc.EV[cc.EV.length] = {
                        target:con.find('a.ks-title'),
                        type:'click',
                        fn:function (e) {
                            try {
                                cc.timmer.hidePopup();
                                e.preventDefault();
                            } catch (exp) {
                            }
                            e.target = panda(e.target);
                            var setime_node = con.find('.ks-setime');
                            setime_node.html('');

                            var tpl = cc.template_nav_html.expand({
                                the_month:cc.month,
                                the_year:cc.year
                            });

                            setime_node.html(tpl);
                            setime_node.removeClass('hidden');
                            con.find('input').on('keydown', function (e) {
                                e.target = panda(e.target);
                                if (e.keyCode == 38) {//up
                                    e.target.val(Number(e.target.val()) + 1);
                                    e.target[0].select();
                                }
                                if (e.keyCode == 40) {//down
                                    e.target.val(Number(e.target.val()) - 1);
                                    e.target[0].select();
                                }
                                if (e.keyCode == 13) {//enter
                                    var _month = con.find('.ks-setime').find('select').val();
                                    var _year = con.find('.ks-setime').find('input').val();
                                    con.find('.ks-setime').addClass('hidden');
                                    if (!cc.Verify().isYear(_year)) {
                                        return;
                                    }
                                    if (!cc.Verify().isMonth(_month)) {
                                        return;
                                    }
                                    cc.father._render({
                                        date:new Date(_year + '/' + _month + '/01')
                                    });
                                    panda(cc.father).trigger(cc.father.EVENTS.MOUSECHANGE,
                                        new Date(_year + '/' + _month + '/01')
                                    );
                                }
                            });
                        }
                    };
                    bindEventTev();
                    tev = cc.EV[cc.EV.length] = {
                        target:con.find(".ks-setime"),
                        type:"click",
                        fn:function(e){
                            e.preventDefault();
                            e.target = panda(e.target);
                            if(e.target.hasClass("ok")){
                                var _month = con.find(".ks-setime").find("select").val();
                                var _year = con.find(".ks-setime").find("input").val();
                                con.find(".ks-setime").addClass("hidden");
                                if(!cc.Verify().isYear(_year)){
                                    return;
                                }
                                if(!cc.Verify().isMonth(_month)){
                                    return;
                                }
                                cc.father._render({
                                    date:new Date(_year + '/' + _month + '/01')
                                });
                                panda(cc.father).trigger(cc.father.EVENTS.MOUSECHANGE,
                                        new Date(_year + '/' + _month + '/01')
                                );
                            }else if(e.target.hasClass("cancel")){
                                con.find(".ks-setime").addClass("hidden");
                            }
                        }
                    };
                 bindEventTev();
                }

         },

          //月加
        this._monthAdd = function () {
            var self = this;
            if (self.month == 11) {
                self.year++;
                self.month = 0;
            } else {
                self.month++;
            }
        },

        //月减
        this._monthMinus = function () {
            var self = this;
            if (self.month === 0) {
                self.year--;
                self.month = 11;
            } else {
                self.month--;
            }
        },
            //年加
        this._yearAdd = function () {
            var self = this;
            self.year++;
        };

        //年减
        this._yearMinus = function () {
            var self = this;
            self.year--;
        };

        /**
         * 得到当前子日历的node引用
         */
        this._getNode = function () {
            var cc = this;
            return cc.node;
        };

         this.render = function(){
             var cc = this;
             cc._renderUI();
             cc._buildEvent();
             return this;
         };
     },
        /**
         * 时间选择构造器
         * @constructor S.Calendar.TimerSelector
         * @param {Object} ft ,timer所在的容器
         * @param {Object} father 指向S.Calendar实例的指针，需要共享父框的参数
         */
        TimeSelector:function(ft, father) {
            //属性

            this.father = father;
            this.fcon = ft.parent('.ks-cal-box');
            this.popupannel = this.fcon.find('.ks-selectime');//点选时间的弹出层
            if (typeof father._time == 'undefined') {//确保初始值和当前时间一致
                father._time = new Date();
            }
            this.time = father._time;
            this.status = 's';//当前选择的状态，'h','m','s'依次判断更新哪个值

            this.ctime = panda.util.template.create('<div class="ks-cal-time">时间：<span class="h">h</span>:<span class="m">m</span>:<span class="s">s</span><!--{{arrow--><div class="cta"><button class="u"></button><button class="d"></button></div><!--arrow}}--></div>');
            this.button = panda.util.template.create('<button class="ct-ok">确定</button>');
            //小时

            this.h_a = ['00','01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20','21','22','23'];
            //分钟

            this.m_a = ['00','10','20','30','40','50'];
            //秒

            this.s_a = ['00','10','20','30','40','50'];


            //方法

            /**
             * 创建相应的容器html，值均包含在a中
             * 参数：要拼装的数组
             * 返回：拼好的innerHTML,结尾还要带一个关闭的a
             *
             */
            this.parseSubHtml = function(a) {
                var in_str = '';
                for (var i = 0; i < a.length; i++) {
                    in_str += '<a href="javascript:void(0);" class="item">' + a[i] + '</a>';
                }
                in_str += '<a href="javascript:void(0);" class="x">x</a>';
                return in_str;
            };
            /**
             * 显示ks-selectime容器
             * 参数，构造好的innerHTML
             */
            this.showPopup = function(instr) {
                var self = this;
                this.popupannel.html(instr);
                this.popupannel.removeClass('hidden');
                var status = self.status;
                self.ctime.all('span').removeClass('on');
                switch (status) {
                    case 'h':
                        self.ctime.all('.h').addClass('on');
                        break;
                    case 'm':
                        self.ctime.all('.m').addClass('on');
                        break;
                    case 's':
                        self.ctime.all('.s').addClass('on');
                        break;
                }
            };
            /**
             * 隐藏ks-selectime容器
             */
            this.hidePopup = function() {
                this.popupannel.addClass('hidden');
            };
            /**
             * 不对其做更多的上下文假设，仅仅根据time显示出来

             */
            this.render = function() {
                var self = this;
                var h = self.get('h');
                var m = self.get('m');
                var s = self.get('s');
                self.father._time = self.time;
                self.ctime = ft.find(".ks-cal-time");
                self.ctime.find('.h').html(h);
                self.ctime.find('.m').html(m);
                self.ctime.find('.s').html(s);
                return self;
            };
            //这里的set和get都只是对time的操作，并不对上下文做过多假设

            /**
             * set(status,v)
             * h:2,'2'
             */
            this.set = function(status, v) {
                var self = this;
                v = Number(v);
                switch (status) {
                    case 'h':
                        self.time.setHours(v);
                        break;
                    case 'm':
                        self.time.setMinutes(v);
                        break;
                    case 's':
                        self.time.setSeconds(v);
                        break;
                }
                self.render();
            };
            /**
             * get(status)
             */
            this.get = function(status) {
                var self = this;
                var time = self.time;
                switch (status) {
                    case 'h':
                        return time.getHours();
                    case 'm':
                        return time.getMinutes();
                    case 's':
                        return time.getSeconds();
                }
            };

            /**
             * add()
             * 状态值代表的变量增1

             */
            this.add = function() {
                var self = this;
                var status = self.status;
                var v = self.get(status);
                v++;
                self.set(status, v);
            };
            /**
             * minus()
             * 状态值代表的变量增1

             */
            this.minus = function() {
                var self = this;
                var status = self.status;
                var v = self.get(status);
                v--;
                self.set(status, v);
            };


            //构造

            this._init = function() {
                var self = this;
                var tpl = self.ctime.expand({});
                var btn = self.button.expand({});
                ft.html('').append(tpl);
                ft.append(btn);
                self.render();
                self.popupannel.on('click', function(e) {
                    var el = panda(e.target);
                    if (el.hasClass('x')) {//关闭
                        self.hidePopup();
                    } else if (el.hasClass('item')) {//点选一个值
                        var v = Number(el.html());
                        self.set(self.status, v);
                        self.hidePopup();
                    }
                });
                //确定的动作
                self.button = ft.find(".ct-ok");

                self.button.on('click', function() {
                    //初始化读取父框的date

                    var d = typeof self.father.dt_date == 'undefined' ? self.father.date : self.father.dt_date;
                    d.setHours(self.get('h'));
                    d.setMinutes(self.get('m'));
                    d.setSeconds(self.get('s'));
                    //回调
                    panda(self.father).trigger(self.father.EVENTS.SELECTTIME, d);
                    if (self.father.popup && self.father.closable) {
                        self.father.hide();
                    }
                });
                //ctime上的键盘事件，上下键，左右键的监听
                //TODO 考虑是否去掉


                self.ctime.on('keyup', function(e) {
                    if (e.keyCode == 38 || e.keyCode == 37) {//up or left
                        //e.stopPropagation();
                        e.preventDefault();
                        self.add();
                    }
                    if (e.keyCode == 40 || e.keyCode == 39) {//down or right
                        //e.stopPropagation();
                        e.preventDefault();
                        self.minus();
                    }
                });
                //上的箭头动作

                self.ctime.find('.u').on('click', function() {
                    self.hidePopup();
                    self.add();
                });
                //下的箭头动作

                self.ctime.find('.d').on('click', function() {
                    self.hidePopup();
                    self.minus();
                });
                //弹出选择小时

                self.ctime.find('.h').on('click', function() {
                    var in_str = self.parseSubHtml(self.h_a);
                    self.status = 'h';
                    self.showPopup(in_str);
                });
                //弹出选择分钟

                self.ctime.find('.m').on('click', function() {
                    var in_str = self.parseSubHtml(self.m_a);
                    self.status = 'm';
                    self.showPopup(in_str);
                });
                //弹出选择秒

                self.ctime.find('.s').on('click', function() {
                    var in_str = self.parseSubHtml(self.s_a);
                    self.status = 's';
                    self.showPopup(in_str);
                });


            };
            this._init();


        }


    });
 });
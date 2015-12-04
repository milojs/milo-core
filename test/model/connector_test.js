'use strict';


var milo = require('../../lib/milo-core')
    , Model = milo.Model
    , assert = require('assert')
    , _ = require('protojs');


describe('Connector', function() {
    it('should connect two models', function(done) {
        var m1 = new Model
            , m2 = new Model
            , c = milo.minder(m1, '<<->>', m2);

        m1('.info.name').set('milo');

        _.defer(function() {
            assert.deepEqual(m2.get(), { info: { name: 'milo' } } );
            done();
        });
    });

    it('should allow path translation', function(done) {
        var m1 = new Model
            , m2 = new Model
            , c = milo.minder(m1, '<->', m2, { pathTranslation: {
                '.info.name': '.myInfo.myName'
            } });

        m1('.info.name').set('milo');

        _.defer(function() {
            assert.deepEqual(m2._data, { myInfo: { myName: 'milo' } } );

            m1._data = undefined;
            m2('.myInfo.myName').set('jason');

            _.defer(function() {
                assert.deepEqual(m1._data, { info: { name: 'jason' } } );
                done();
            });
        });
    });

    it('should support splice method', function(done) {
        var m1 = new Model
            , m2 = new Model
            , c = milo.minder(m1, '<<->>', m2);

        m1.set([1,2,3]);

        _.defer(function() {
            assert.deepEqual(m2.get(), [1,2,3] );

            m1.splice(1,1);

            _.defer(function() {
                assert.deepEqual(m2.get(), [1,3] );
                done();
            });
        });
    });

    it('should connect model paths', function(done) {
        var m1 = new Model
            , m2 = new Model
            , c = milo.minder(m1('.path1'), '<<->>', m2('.path2'));

        m1('.path1.info.name').set('milo');

        _.defer(function() {
            assert.deepEqual(m2('.path2').get(), { info: { name: 'milo' } } );
            done();
        });
    });

    it('change_data should not break change batches as they pass via connections', function(done) {
        var m1 = new Model
            , m2 = new Model
            , m3 = new Model;

        var testData = {
            title: 'Title 1',
            desc: 'Description 1',
            info: { name: 'Jason', surname: 'Green' }
        };

        var c1 = milo.minder(m1, '<->', m2, { pathTranslation: {
                '.title': '.title',
                '.desc': '.desc',
                '.info.name': '.info.name',
                '.info.surname': '.info.surname'
            }});
        var c2 = milo.minder(m2, '<<->>', m3);

        m1.set(testData);

        _.deferTicks(function() {
            assert.deepEqual(m3.get(), testData );
            done();
        }, 2);
    });


    it('I can change the mode of the connection', function(done) {
        var m1 = new Model
            , m2 = new Model
            , c = milo.minder(m1, '<<-', m2).changeMode('<<->>');

        m1('.info.name').set('milo');

        _.defer(function() {
            assert.deepEqual(m2.get(), { info: { name: 'milo' } } );
            done();
        });
    });


    it('I can change the mode of the connection in the next tick', function(done) {
        var m1 = new Model
            , m2 = new Model
            , c = milo.minder(m1, '<<-', m2).deferChangeMode('<<->>');

        _.defer(function (){
            m1('.info.name').set('milo');
            _.defer(function() {
                assert.deepEqual(m2.get(), { info: { name: 'milo' } } );
                done();
            });
        });

    });


    it('should allow path translation with patterns', function(done) {
        var m1 = new Model
            , m2 = new Model
            , c = milo.minder(m1, '<->', m2, { pathTranslation: {
                '.info**': '.myInfo**'
            } });

        m1('.info.name').set('milo');
        m1('.info.list[0]').set({ test: 1 });

        _.defer(function() {
            assert.deepEqual(m2._data, { myInfo: { name: 'milo', list: [{ test: 1 }] } } );

            m2('.myInfo.name').set('jason');
            m2('.myInfo.list[1]').set({ test: 2 });

            _.defer(function() {
                assert.deepEqual(m1._data, { info: { name: 'jason', list: [{ test: 1 }, { test: 2 }] } } );
                done();
            });
        });
    });


    it('should correctly propagate splice with path translation with patterns', function(done) {
        var m1 = new Model({ list: [] })
            , m2 = new Model({ myList: [] })
            , c = milo.minder(m1, '<<<->>>', m2, { pathTranslation: {
                '.list**': '.myList**'
            } });

        m1('.list[0].name').set('milo');
        m1('.list').push({ test: 'push' });

        _.defer(function() {
            assert.deepEqual(m2._data, { myList: [
                { name: 'milo' },
                { test: 'push' }
            ] } );
            done();
        });
    });


    it('should correctly propagate splice after set', function(done) {
        var m1 = new Model({ list: [] })
            , m2 = new Model({ list: [] })
            , c = milo.minder(m1, '<<<<->>>>', m2);

        m1('.list[0].name').set('milo');
        m1('.list').push({ test: 'push1' });
        m1('.list').push({ test: 'push2' });

        _.deferTicks(function() {
            assert.deepEqual(m2._data, { list: [
                { name: 'milo' },
                { test: 'push1' },
                { test: 'push2' }
            ] } );
            done();
        }, 2);
    });
});

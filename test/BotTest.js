/**
 * Created by manthanhd on 17/10/2016.
 */
const expect = require('expect');
const sinon = require('sinon');
const mockery = require('mockery');

function mockClassifierWithMockClassifierFactory() {
    var mockClassifier = {
        addDocument: expect.createSpy(),
        train: expect.createSpy()
    };

    var mockClassifierFactoryInstance = {
        newClassifier: function () {
            return mockClassifier
        }
    };

    var MockClassifierFactory = function () {
        return mockClassifierFactoryInstance;
    };

    mockery.registerMock('./ClassifierFactory', MockClassifierFactory);
    return mockClassifier;
}

function mockClassifierFactory() {
    var mockClassifierFactoryInstance = {
        newClassifier: expect.createSpy()
    };

    var MockClassifierFactory = function () {
        return mockClassifierFactoryInstance;
    };

    mockery.registerMock('./ClassifierFactory', MockClassifierFactory);
    return mockClassifierFactoryInstance;
}

describe('Bot', function () {
    const BotTypes = require('../lib/BotTypes');
    const SingleLineMessage = BotTypes.SingleLineMessage;
    const Skill = BotTypes.Skill;
    const Message = BotTypes.Message;
    const Bot = require('../lib/Bot');

    beforeEach(function (done) {
        mockery.enable({warnOnUnregistered: false, warnOnReplace: false});
        done();
    });

    afterEach(function (done) {
        mockery.deregisterAll();
        mockery.disable();
        done();
    });

    describe('<init>', function () {
        it('passes classifierPreference property from config to ClassifierFactory', function (done) {
            var naturalMock = {};

            mockery.registerMock('natural', naturalMock);

            var mockClassifierFactoryInstance = mockClassifierFactory();

            var bot = new Bot({classifierPreference: 'naive_bayes'});

            expect(mockClassifierFactoryInstance.newClassifier.calls.length).toBe(1);
            expect(mockClassifierFactoryInstance.newClassifier).toHaveBeenCalledWith(naturalMock, 'naive_bayes');
            done();
        });

        it('prefers passed in classifier over classifierPreference in config', function () {
            var natural = require('natural');
            var fakeClassifier = {fakeClassifer: 'myclassifier'};
            var bot = new Bot({classifier: fakeClassifier, classifierPreference: 'naive_bayes'});
            var classifier = bot.getClassifier();
            expect(classifier).toExist();
            expect(classifier).toNotBeA(natural.BayesClassifier);
            expect(classifier).toBe(fakeClassifier);
        });
    });

    describe('train', function () {
        it('trains single document when parameters are valid', function (done) {
            var mockClassifier = mockClassifierWithMockClassifierFactory();

            var bot = new Bot({classifierPreference: 'naive_bayes'});
            bot.train('topic', 'text');

            expect(mockClassifier.addDocument).toHaveBeenCalledWith('text', 'topic');
            expect(mockClassifier.train).toHaveBeenCalled();
            done();
        });

        it('throws TypeError when topic is undefined', function (done) {
            var bot = new Bot();
            try {
                bot.train(undefined);
                done('should have failed.');
            } catch (e) {
                expect(e).toBeA(TypeError);
                done();
            }
        });

        it('throws TypeError when topic is not String', function (done) {
            var bot = new Bot();
            try {
                bot.train([]);
                done('should have failed.');
            } catch (e) {
                expect(e).toBeA(TypeError);
                done();
            }
        });

        it('throws TypeError when text is undefined', function (done) {
            var bot = new Bot();
            try {
                bot.train('topic', undefined);
                done('should have failed.');
            } catch (e) {
                expect(e).toBeA(TypeError);
                done();
            }
        });

        it('throws TypeError when text is not String', function (done) {
            var bot = new Bot();
            try {
                bot.train('topic', []);
                done('should have failed.');
            } catch (e) {
                expect(e).toBeA(TypeError);
                done();
            }
        });
    });

    describe('trainAll', function () {

        it('trains all documents when parameters are valid', function (done) {
            var mockClassifier = mockClassifierWithMockClassifierFactory();

            var bot = new Bot({classifierPreference: 'naive_bayes'});
            bot.trainAll([{text: 'hello', topic: 'topic'}, {text: 'hello2', topic: 'topic2'}], function (err) {
                expect(err).toNotExist();
                expect(mockClassifier.addDocument).toHaveBeenCalledWith('hello', 'topic');
                expect(mockClassifier.addDocument).toHaveBeenCalledWith('hello2', 'topic2');
                expect(mockClassifier.train).toHaveBeenCalled();
                done();
            });
        });

        it('throws TypeError when documents is not an array', function (done) {
            var mockClassifier = mockClassifierWithMockClassifierFactory();

            var bot = new Bot({classifierPreference: 'naive_bayes'});
            bot.trainAll('not_an_array', function (err) {
                expect(err).toExist();
                expect(err).toBeA(TypeError);
                done();
            });
        });

        it('throws TypeError when documents is undefined', function (done) {
            var mockClassifier = mockClassifierWithMockClassifierFactory();

            var bot = new Bot({classifierPreference: 'naive_bayes'});
            bot.trainAll(undefined, function (err) {
                expect(err).toExist();
                expect(err).toBeA(TypeError);
                done();
            });
        });
    });

    describe('addSkill', function () {

        it('adds given skill', function (done) {
            var bot = new Bot();

            const fakeSkillFn = function (context, req, res, next) {
            };

            const fakeSkill = new Skill('fakeskill', 'topic', fakeSkillFn);
            bot.addSkill(fakeSkill);

            const skills = bot.getSkills();
            expect(skills.length).toBe(1);
            done();
        });

        it('throws TypeError when skill is undefined', function (done) {
            var bot = new Bot();
            try {
                bot.addSkill(undefined);
                done('should have failed.');
            } catch (e) {
                expect(e).toBeA(TypeError);
                done();
            }
        });

        it('throws TypeError when skill is not of type Skill', function (done) {
            var bot = new Bot();
            try {
                bot.addSkill([]);
                done('should have failed.');
            } catch (e) {
                expect(e).toBeA(TypeError);
                done();
            }
        });
    });

    describe('resolve', function () {
        it("resolves multi sentence message into a multi message response", function (done) {
            var mockClassifier = mockClassifierWithMockClassifierFactory();
            mockClassifier.getClassifications = expect.createSpy().andCall(function (sentence) {
                if (sentence === 'Hello.') return [{label: 'mytopic', value: 1}];
                return [{label: 'myanothertopic', value: 1}];
            });

            var fakeMyTopicSkill = new Skill('myfakeskill', 'mytopic', expect.createSpy().andCall(function (context, request, response, next) {
                response.message = new SingleLineMessage('mytopic response');
                return next()
            }));

            var fakeMyAnotherTopicSkill = new Skill('myanotherfakeskill', 'myanothertopic', expect.createSpy().andCall(function (context, request, response, next) {
                response.message = new SingleLineMessage('myanothertopic response');
                return next()
            }));

            var bot = new Bot();
            bot.addSkill(fakeMyTopicSkill);
            bot.addSkill(fakeMyAnotherTopicSkill);

            return bot.resolve(123, "Hello. Hi", function (err, messages) {
                if (err) return done(err);

                expect(messages).toBeA(Array);
                expect(messages.length).toBe(2);
                expect(messages[0]).toBeA(Message);
                expect(messages[0].content).toBe('mytopic response');
                expect(messages[1]).toBeA(Message);
                expect(messages[1].content).toBe('myanothertopic response');
                done();
            });
        });

        it('saves context by correspondance id', function (done) {
            var mockClassifier = mockClassifierWithMockClassifierFactory();
            mockClassifier.getClassifications = expect.createSpy().andCall(function (sentence) {
                if (sentence === 'Hello.') return [{label: 'mytopic', value: 1}];
                return [{label: 'myanothertopic', value: 1}];
            });

            var contextStore = {
                put: function (id, context, callback) {
                    return callback(undefined, context);
                },

                get: function (id, callback) {
                    return callback(undefined, undefined);
                }
            };

            var contextStore_putSpy = expect.spyOn(contextStore, 'put').andCallThrough();
            var contextStore_getSpy = expect.spyOn(contextStore, 'get').andCallThrough();

            var fakeMyTopicSkill = new Skill('myfakeskill', 'mytopic', expect.createSpy().andCall(function (context, request, response, next) {
                response.message = new SingleLineMessage('mytopic response');
                return next()
            }));

            var fakeMyAnotherTopicSkill = new Skill('myanotherfakeskill', 'myanothertopic', expect.createSpy().andCall(function (context, request, response, next) {
                response.message = new SingleLineMessage('myanothertopic response');
                return next()
            }));

            var bot = new Bot({contextStore: contextStore});
            bot.addSkill(fakeMyTopicSkill);
            bot.addSkill(fakeMyAnotherTopicSkill);

            return bot.resolve(123, "Hello. Hi", function (err, messages) {
                if (err) return done(err);

                expect(contextStore_putSpy).toHaveBeenCalled();
                expect(contextStore_getSpy).toHaveBeenCalled();
                done();
            });
        });

        it('returns messages as well as error when failed to memorize context', function (done) {
            var mockClassifier = mockClassifierWithMockClassifierFactory();
            mockClassifier.getClassifications = expect.createSpy().andCall(function (sentence) {
                if (sentence === 'Hello.') return [{label: 'mytopic', value: 1}];
                return [{label: 'myanothertopic', value: 1}];
            });

            var contextStore = {
                put: function (id, context, callback) {
                    return callback(new Error("hurr durr i failed to memorize context"), context);
                },

                get: function (id, callback) {
                    return callback(undefined, undefined);
                }
            };

            var fakeMyTopicSkill = new Skill('myfakeskill', 'mytopic', expect.createSpy().andCall(function (context, request, response, next) {
                response.message = new SingleLineMessage('mytopic response');
                return next()
            }));

            var fakeMyAnotherTopicSkill = new Skill('myanotherfakeskill', 'myanothertopic', expect.createSpy().andCall(function (context, request, response, next) {
                response.message = new SingleLineMessage('myanothertopic response');
                return next()
            }));

            var bot = new Bot({contextStore: contextStore});
            bot.addSkill(fakeMyTopicSkill);
            bot.addSkill(fakeMyAnotherTopicSkill);

            return bot.resolve(123, "Hello. Hi", function (err, messages) {
                expect(err).toExist();
                expect(err.message).toBe('hurr durr i failed to memorize context');

                expect(messages).toExist();
                expect(messages.length).toBe(2);
                done();
            });
        });

        it('has access to sentence metadata when skill is processing the request', function (done) {
            var mockClassifier = mockClassifierWithMockClassifierFactory();
            mockClassifier.getClassifications = expect.createSpy().andCall(function (sentence) {
                if (sentence === 'Hello.') return [{label: 'mytopic', value: 1}];
                return [{label: 'myanothertopic', value: 1}];
            });

            var fakeTopicSkillCalled = false;
            var fakeAnotherTopicSkillCalled = false;

            var fakeMyTopicSkill = new Skill('myfakeskill', 'mytopic', expect.createSpy().andCall(function (context, request, response, next) {
                expect(request.sentence).toExist();
                expect(request.sentence.current).toBe("Hello.");
                expect(request.sentence.index).toBe(0);

                expect(request.sentence.all).toExist();
                expect(request.sentence.all.length).toBe(2);
                expect(request.sentence.all[0]).toBe("Hello.");
                expect(request.sentence.all[1]).toBe("Hi.");
                fakeTopicSkillCalled = true;

                response.message = new SingleLineMessage('mytopic response');
                return next();
            }));

            var fakeMyAnotherTopicSkill = new Skill('myanotherfakeskill', 'myanothertopic', expect.createSpy().andCall(function (context, request, response, next) {
                expect(request.sentence).toExist();
                expect(request.sentence.current).toBe("Hi.");
                expect(request.sentence.index).toBe(1);

                expect(request.sentence.all).toExist();
                expect(request.sentence.all.length).toBe(2);
                expect(request.sentence.all[0]).toBe("Hello.");
                expect(request.sentence.all[1]).toBe("Hi.");

                fakeAnotherTopicSkillCalled = true;

                response.message = new SingleLineMessage('myanothertopic response');
                return next();
            }));

            var bot = new Bot();
            bot.addSkill(fakeMyTopicSkill);
            bot.addSkill(fakeMyAnotherTopicSkill);

            return bot.resolve(123, "Hello. Hi.", function (err, messages) {
                expect(fakeTopicSkillCalled).toBe(true);
                expect(fakeAnotherTopicSkillCalled).toBe(true);

                return done();
            });
        });

        it('has access to topic metadata when skill is processing the request', function (done) {
            var mockClassifier = mockClassifierWithMockClassifierFactory();
            mockClassifier.getClassifications = expect.createSpy().andCall(function (sentence) {
                if (sentence === 'Hello.') return [{label: 'mytopic', value: 1}];
                return [{label: 'myanothertopic', value: 1}];
            });

            var fakeTopicSkillCalled = false;
            var fakeAnotherTopicSkillCalled = false;

            var fakeMyTopicSkill = new Skill('myfakeskill', 'mytopic', expect.createSpy().andCall(function (context, request, response, next) {
                expect(request.skill).toExist();
                expect(request.skill.index).toBe(0);

                expect(request.skill.all).toExist();
                expect(request.skill.all.length).toBe(2);
                expect(request.skill.all[0].name).toBe(fakeMyTopicSkill.name);
                expect(request.skill.all[1].name).toBe(fakeMyAnotherTopicSkill.name);
                fakeTopicSkillCalled = true;

                response.message = new SingleLineMessage('mytopic response');
                return next();
            }));

            var fakeMyAnotherTopicSkill = new Skill('myanotherfakeskill', 'myanothertopic', expect.createSpy().andCall(function (context, request, response, next) {
                expect(request.skill).toExist();
                expect(request.skill.index).toBe(1);

                expect(request.skill.all).toExist();
                expect(request.skill.all.length).toBe(2);
                expect(request.skill.all[0].name).toBe(fakeMyTopicSkill.name);
                expect(request.skill.all[1].name).toBe(fakeMyAnotherTopicSkill.name);
                fakeAnotherTopicSkillCalled = true;

                response.message = new SingleLineMessage('myanothertopic response');
                return next();
            }));

            var bot = new Bot();
            bot.addSkill(fakeMyTopicSkill);
            bot.addSkill(fakeMyAnotherTopicSkill);

            return bot.resolve(123, "Hello. Hi.", function (err, messages) {
                expect(fakeTopicSkillCalled).toBe(true);
                expect(fakeAnotherTopicSkillCalled).toBe(true);
                return done();
            });
        });

        it('does not call the next skill when previous skill calls final()', function (done) {
            var mockClassifier = mockClassifierWithMockClassifierFactory();
            mockClassifier.getClassifications = expect.createSpy().andCall(function (sentence) {
                if (sentence === 'Hello.') return [{label: 'mytopic', value: 1}];
                return [{label: 'myanothertopic', value: 1}];
            });

            var fakeMyTopicSkill = new Skill('myfakeskill', 'mytopic', expect.createSpy().andCall(function (context, request, response, next) {
                response.message = new SingleLineMessage('mytopic response');
                response.final();
            }));

            var fakeMyAnotherTopicSkill = new Skill('myanotherfakeskill', 'myanothertopic', expect.createSpy().andCall(function (context, request, response, next) {
                done('This skill should not have been called.');
            }));

            var bot = new Bot();
            bot.addSkill(fakeMyTopicSkill, 1);
            bot.addSkill(fakeMyAnotherTopicSkill, 1);

            return bot.resolve(123, "Hello. Hi.", function (err, messages) {
                expect(messages.length).toBe(1);
                expect(messages[0].content).toBe('mytopic response');
                return done();
            });
        });

        it('resolves context from a previously saved context with the built in context store', function (done) {
            var mockClassifier = mockClassifierWithMockClassifierFactory();
            mockClassifier.getClassifications = expect.createSpy().andCall(function (sentence) {
                if (sentence === 'Hello.') return [{label: 'mytopic', value: 1}];
                return [{label: 'myanothertopic', value: 1}];
            });

            var firstRun = true;

            var fakeMyTopicSkill = new Skill('myfakeskill', 'mytopic', expect.createSpy().andCall(function (context, request, response, next) {
                if(firstRun === true) {
                    expect(context.something).toNotExist();
                } else {
                    expect(context.something).toExist();
                }

                response.message = new SingleLineMessage('mytopic response');
                return next();
            }));

            var bot = new Bot();
            bot.addSkill(fakeMyTopicSkill);

            bot.resolve(123, "Hello.", function(err, messages) {
                expect(err).toNotExist();
            });
            return bot.resolve(123, "Hello.", function (err, messages) {
                expect(err).toNotExist();
                done();
            });
        });

        it('returns skills could not be resolved error when it couldn\'t resolve skills', function (done) {
            var mockClassifier = mockClassifierWithMockClassifierFactory();
            mockClassifier.getClassifications = expect.createSpy().andCall(function (sentence) {
                if (sentence === 'Hello.') return [{label: 'mytopic', value: 0.2}];
                return [{label: 'myanothertopic', value: 1}];
            });

            var firstRun = true;

            var fakeMyTopicSkill = new Skill('myfakeskill', 'mytopic', expect.createSpy().andCall(function (context, request, response, next) {
                if(firstRun === true) {
                    expect(context.something).toNotExist();
                } else {
                    expect(context.something).toExist();
                }

                response.message = new SingleLineMessage('mytopic response');
                return next();
            }));

            var bot = new Bot();
            bot.addSkill(fakeMyTopicSkill, 1);

            bot.resolve(123, "Hello.", function(err, messages) {
                expect(err).toExist();
                done();
            });
        });

        it('calls mapped undefined skill when skill cannot be found for a topic', function (done) {
            mockery.deregisterAll();
            mockery.disable();

            var fakeMyTopicSkill = new Skill('myskill', undefined, expect.createSpy().andCall(function (context, request, response, next) {
                response.message = new SingleLineMessage('mytopic response');
                return next();
            }));

            var bot = new Bot();
            bot.addSkill(fakeMyTopicSkill);

            var resolved = function (err, messages) {
                expect(err).toNotExist();

                expect(messages).toExist();
                expect(messages.length).toBe(1);
                expect(messages[0].content).toBe('mytopic response');
                done();
            };
            return bot.resolve(123, "kiwi", resolved);
        });

        it('calls skills based on confidence level', function (done) {
            mockery.deregisterAll();
            mockery.disable();

            var fakeMyTopicSkill = new Skill('myskill', 'hello', expect.createSpy().andCall(function (context, request, response, next) {
                response.message = new SingleLineMessage('mytopic response');
                return next();
            }));

            var bot = new Bot({classifierPreference: 'naive_bayes'});
            bot.train('hello', 'hey there');
            bot.train('hello', 'hello there');
            bot.train('hello', 'hello');
            bot.addSkill(fakeMyTopicSkill, 0.8);

            var resolved = function (err, messages) {
                expect(err).toNotExist();

                expect(messages).toExist();
                expect(messages.length).toBe(1);
                expect(messages[0].content).toBe('mytopic response');
                done();
            };
            return bot.resolve(123, "kiwi", resolved);
        });
    });

    describe('getContextStore', function () {
        const ContextStore = require('../lib/ContextStore');
        it('gets context store', function () {
            var bot = new Bot();
            var contextStore = bot.getContextStore();
            expect(contextStore).toExist();
            expect(contextStore).toBeA(ContextStore);
        });

        it('gets passed in context store', function () {
            var fakeContextStore = {
                put: function () {
                }, get: function () {
                }, remove: function () {
                }
            };
            var bot = new Bot({contextStore: fakeContextStore});
            var contextStore = bot.getContextStore();
            expect(contextStore).toExist();
            expect(contextStore).toNotBeA(ContextStore);
            expect(contextStore).toBe(fakeContextStore);
        });
    });

    describe('getClassifier', function () {
        it('gets initialised default LogisticRegression classifier', function () {
            var natural = require('natural');
            var bot = new Bot();
            var classifier = bot.getClassifier();
            expect(classifier).toExist();
            expect(classifier).toBeA(natural.LogisticRegressionClassifier);
        });

        it('gets passed in classifier', function () {
            var natural = require('natural');
            var fakeClassifier = {myclassifier: 'classifier'};
            var bot = new Bot({classifier: fakeClassifier});
            var classifier = bot.getClassifier();
            expect(classifier).toExist();
            expect(classifier).toNotBeA(natural.LogisticRegressionClassifier);
            expect(classifier).toBe(fakeClassifier);
        });
    });
});
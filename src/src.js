if (Meteor.isClient) {
  Template.hello.greeting = function () {
    return "Welcome to Smeg.";
  };

  Template.hello.events({
    'click input' : function () {
      // template data, if any, is available in 'this'
      if (typeof console !== 'undefined')
        console.log("You pressed the button");
    },
    'click a' : function () {
      if (typeof console !== 'undefined')
        console.log("You pressed the other button...");
    }
  });
}

if (Meteor.isServer) {
  Meteor.startup(function () {
    // code to run on server at startup
  });
}

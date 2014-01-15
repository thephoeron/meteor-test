[Extra form validation angular-ui]: http://angular-ui.github.com/
[AngularJS]: http://angularjs.org/
[Meteor]: http://meteor.com/
[Node.js]: http://nodejs.org/
[Postgres]: http://www.postgresql.org/
[TimeTracker]: http://www.lshift.net/timetracker.html
[Meteorite]: https://github.com/oortcloud/meteorite
[Meteor Postgres]: http://stackoverflow.com/questions/10802191/using-meteor-with-postgresql
[Node.js pg]: http://gurjeet-tech.blogspot.co.uk/2012/11/install-pg-nodejs-module-node-postgres.html
[Postgres Node.js LISTEN NOTIFY]: http://bjorngylling.com/2011-04-13/postgres-listen-notify-with-node-js.html
[pg Standalone Client]: http://lheurt.blogspot.co.uk/2011/11/listen-to-postgresql-inserts-with.html
[Meteor Fibers]: http://stackoverflow.com/questions/10192938/meteor-code-must-always-run-within-a-fiber-when-calling-collection-insert-on-s
[Fiber]: http://en.wikipedia.org/wiki/Fiber_(computer_science)
[Node Fibers]: https://github.com/laverdet/node-fibers
[Node Postgres]: https://github.com/brianc/node-postgres
[Meteor-AngularJS]: https://github.com/lvbreda/Meteor_angularjs
[Meteor Angular Leaderboard demo]: https://github.com/bevanhunt/meteor-angular-leaderboard
[Meteor Principles]: http://docs.meteor.com/#sevenprinciples
[NOTIFY]: http://www.postgresql.org/docs/9.0/static/sql-notify.html
[LISTEN]: http://www.postgresql.org/docs/9.0/static/sql-listen.html
[js2coffee]: http://js2coffee.org/

# Live Updates to Meteor from Postgres

From: http://www.lshift.net/blog/2013/02/25/live-updates-to-meteor-from-postgres

I’ve been playing around with [Meteor][] recently for an internal LShift
project in which I wanted the browser to have a read-only live view onto
some timetracking data from [TimeTracker][] as it changes. When a developer records time
spent on a particular task, a row is inserted into a [Postgres][] database. Simples.

One of Meteor’s selling points is its transparent client-server data
synchronisation through its powerful `Collections` API, which is backed by
MongoDB on the server side. This poses a potential challenge for us: how can we leverage the reactive `Collection`s of Meteor yet feed it with Postgres data?

Well, I did manage to wrestle my fork of Bevan
Hunt’s (a Meteor contributor!) excellent [Meteor Angular Leaderboard demo][]
into live page update as database insertions occur on Postgres. You could extend this to deal with database updates and deletions as well, an exercise left for the willing.


Don’t worry about [AngularJS][] too much: we don’t really use it much in this post. I just like to have it kicking around in my project to deliver a reactive, keeps-you-on-the-edge client-side experience for other parts of the project which we won’t discuss.

### Prerequisites

Be sure to install [Meteor][] and [Meteorite][] (helps us fetch the [AngularJS
smart package for Meteor][Meteor-AngularJS]).

[gist id=e478508a9837389600c7]

Browse to `http://localhost:3000/` and click around.

Also, set up your Postgres instance as you’d like it. Let’s say for this post,
there’s a database called `youramazingpostgresdb` which lives at `localhost`.

### Connecting to Postgres from Meteor

According to this [StackOverflow question][Meteor Postgres] the ‘right’ way to
do this would be to write a Postgres driver / connector for Meteor, but that
sounds very much like overkill for my use case.

Instead, I intend on mirroring the Postgres database inserts with Meteor’s
backing Mongo. Besides providing redundancy, doing this will let us leverage
Meteor’s existing [latency compensation][Meteor Principles] mechanisms and
client-side database cache. And it’ll be quicker to implement. What’s not to like?

### Connecting to Postgres from Node

Well, Meteor runs on [Node.js][], right? So we can just use the [Node.js
connector for Postgres][Node Postgres] to access the database.

It wasn’t obvious how to download and use `npm` packages together with Meteor
but luckily [Gurjeet Singh's post here][Node.js pg] shows us how. I use a Mac
so I don’t apply his Ubuntu PATH hack below.

[gist id=88ef92a8a359f49e710c]

And in `server/server.coffee`, we require `pg`. While we’re at it, let’s specify the connection string as well.

[gist id=a7dd965ea731f6351b1c]

### Set up a notification channel on Postgres

[BjÃ¶rn Gylling's post here][Postgres Node.js LISTEN NOTIFY] shows us what to
do. Basically, we make use of the [NOTIFY][] and [LISTEN][] commands in
Postgres. Be sure to use version 9.x, because even though version 8.x also
has support for them, we rely on notification payloads later on which [were only
introduced in 9.0][NOTIFY].

Log in to Postgres, and create a dummy table.

[gist id=b2aa7fcb0cd4743fab8a]

We create a notification function that spits out a JSON structure that
represents the row just inserted…

[gist id=5d76cccfd5c53c1d83fb]

… which we call whenever the table `foo` does a row insert.

[gist id=6b40e600e4971ceb20ce]

### Register Meteor (Node, really) for table inserts

Okay, just as the post shows us, we use `pg.connect` to register a watcher,
being mindful that we’ve got a `pg` included for use with Meteor in a slightly
different way than normal. (as a side note, you might find [js2coffee][] useful
when converting Javascript into Coffeescript)

Let’s mirror the Postgres table `foo` with a Meteor Collection called `Foos`.
[gist id=d1c121a5708afdabfbbe]

### It works! … Sorta.

Start Meteor again if it’s not already running…

[gist id=e8916e55ba5c1bb5424c]

… and on `psql` insert something into your table `foo`…

[gist id=527e04b5acfa8296c145]

… and you’ll see a notification like this on the server console.

[gist id=1cad65a50a39d5539fdd]

But try to add a second row, and Meteor doesn’t get notified. I found out from
this post that the single-shot `pg.connect` wasn’t what we were looking for.
Rather, we want a [standalone client][pg Standalone Client] that’d passively
listen for notifications.

Let’s update `server.coffee`. This time we also make the handler parse the payload JSON and insert the object into my Meteor Collection `Foos` rather than just printing it out to console.

[gist id=916c878d0120a65b6b3c]

I restart the server, and BAM!

[gist id=bc7dd884eb2fc76da495]

What on Earth’s this!

Turns out (thanks to [this SO question][Meteor Fibers]) that the error has to do with Meteor’s concurrency model. The error was thrown because
Meteor is opinionated and likes everything to run on a single thread. My handler was executing `Foo.insert` (a Meteor data API call) from `pg`’s asynchronous event handler `client.on`, and that was definitely from another thread.

Meteor wants your code (at least, its data access calls) to be run from what’s called a
[Fiber][] (I know, fellow citizens of Britain. I know, I feel your pain) so that it can schedule your Fiber for execution on that single thread. Fibers are themselves a bit like threads, except that they aren’t ever pre-empted: they run until each of them yield voluntarily. Fiber executions are
then interleaved to form a braid of cooporative multitasking. All of this is managed by the [Node Fibers][] package.

Our solution here is simple: just wrap the notification handling code and Fibers will take care of the rest.

[gist id=85a6bcc68580c6ce8fb1]

Fibers will happily run my handling code whenever Meteor feels like yielding some control. This is usally very fast.

### Success!

Now, whenever I insert a row into Postgres, the row insertion will
automatically be mirrored into the `AngularCollection` `Foos`. Meteor works its magic, and sends the update to all browsers viewing the page, in almost real-time.

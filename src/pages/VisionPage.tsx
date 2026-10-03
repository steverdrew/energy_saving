import PublicFooter from '../components/PublicFooter'
import '../styles/publicContent.css'
import './VisionPage.css'

/**
 * OA-151: Vision page -- a long-form editorial/manifesto page using the
 * exact approved copy from the ticket, verbatim. Visually matches the
 * polish of HowItWorksPage.tsx (dark theme, landing-section-band/
 * landing-chapter-cta rhythm, public-page__title/__intro) but deliberately
 * does not reuse the boxed .landing-card treatment for the main body --
 * per the ticket, this should read as a single flowing editorial piece,
 * not a stack of cards. VisionPage.css adds only the prose styling this
 * page needs on top of the shared public-page tokens.
 *
 * Copy updated to the revised flowing-paragraph version (condensed from
 * the original line-by-line draft) -- same claims and section structure,
 * reworded into full paragraphs rather than short fragments.
 *
 * OA-173 (tightening pass): "keep Vision as optional long-form reading,
 * but tighten it." Every section, heading and claim is unchanged; this
 * pass only cuts restated sentences and trims wordier ones (roughly a
 * fifth shorter overall), since the ticket explicitly didn't ask for a
 * rewrite of previously-approved copy, only a tighter edit of it. The
 * quotable lines (section headings, the closing line, the independence
 * line) are untouched, verbatim. The "what's built today vs. direction,
 * not a promise" scope-note added earlier this same ticket is unchanged.
 */
function VisionPage() {
  return (
    <>
      <section className="landing-section-band" aria-label="Our vision">
        <h1 className="public-page__title">Small changes. Bigger consequences.</h1>
      </section>

      <div className="landing-chapter-cta landing-section-band">
        <article className="vision-prose">
          <p>
            Most of us pay for electricity without really understanding it. A bill arrives and a direct debit
            leaves the account. Few of us can answer the basic questions: what am I actually paying for? Would a
            different tariff suit the way my household uses electricity? Is anything worth changing, and is the
            saving worth the inconvenience?
          </p>

          <p>
            Energy has also become more complicated. Smart meters record consumption every half hour, some
            tariffs change price through the day, and cars, batteries and appliances can increasingly decide
            when to use electricity. That should make good decisions easier, but too often it has only created
            more data.
          </p>

          <p>
            We think the useful product is the layer in between — not another dashboard full of graphs, a
            tariff marketplace insisting switching is always the answer, or a smart-home controller trying to
            optimise every minute of your life. Just a clearer answer to a simple question: what is worth doing
            about my electricity, if anything?
          </p>

          <h2>Sometimes the answer should be "nothing"</h2>

          <p>
            When you build a product around saving money, there is an obvious temptation to always find a
            saving — move the dishwasher, change tariff, run something at 2am, or annualise 11p into a much more
            impressive-looking number.
          </p>

          <p>
            But sometimes your current tariff already suits you. Sometimes moving an appliance saves so little
            it isn't worth thinking about, or the cheapest time is an absurd time to ask a real household to do
            something. And sometimes there simply isn't much waste to find. Those aren't bad results — they're
            useful answers, and we'd rather tell you to stay where you are than manufacture a reason to change.
          </p>

          <p>
            That's one of the principles behind what we're building: education before persuasion. No tariff
            needs to win, no supplier needs to win, and no action needs to happen. You just need to understand
            the decision.
          </p>

          <h2>Start with your electricity, not somebody else's average</h2>

          <p>
            A lot of energy advice begins with the typical household — its typical consumption, appliances and
            behaviour. But you don't live in a typical household. You live in yours, so the useful starting
            point is your actual pattern of electricity use.
          </p>

          <p>
            For Octopus Energy customers, we use the consumption data and tariff information already available
            through their account. We only need read access — we don't need to change your tariff or control
            your account. The result is much more concrete than an average: this is what your electricity use
            cost on this tariff.
          </p>

          <p>
            If you don't want to connect anything yet, you can still explore the product using a clearly
            labelled representative household. The important thing is never to blur the two — a model is a
            model, and your data is your data.
          </p>

          <h2>Compare the same household</h2>

          <p>
            Tariff comparisons can become misleading surprisingly quickly — change the tariff, the household
            assumptions, when appliances run and how much electricity is used, then present the final number as
            though the tariff alone created the difference.
          </p>

          <p>
            We do the opposite. We take exactly the same electricity use — the same household, half-hours, kWh
            and events — and price it on another tariff. Only the tariff changes. If the result is cheaper, you
            can see why. If it's more expensive, you can see that too. If it's basically the same, that's useful
            information. There doesn't need to be a winner.
          </p>

          <h2>Then ask whether timing matters</h2>

          <p>
            Changing tariff and changing behaviour are different things, and we keep them separate. Once you've
            looked at the tariff itself, we ask whether any of this electricity could realistically have been
            used at a cheaper time.
          </p>

          <p>
            "Realistically" is doing a lot of work there, because the mathematically cheapest answer isn't
            necessarily the useful one. A washing machine might technically be cheapest at two in the morning,
            but that doesn't make it a sensible recommendation. People sleep, appliances take time, some things
            need supervision, and households have routines — dinner happens around dinner time for a reason.
          </p>

          <p>
            So the aim isn't to find the cheapest possible half-hour. It's to find the cheapest practical option
            for this household — and when we reject a cheaper period, we should be able to tell you why.
          </p>

          {/* OA-168: "Hunt the energy vampires in your home" moves here
              from the homepage hero (OA-111/OA-168) -- feature-level
              language for waste detection specifically, not the whole
              product's master proposition any more. */}
          <h2>Hunt the energy vampires in your home</h2>

          <p>
            There's a third category, different again: waste. This isn't electricity used on the wrong tariff or
            at the wrong time — it's electricity that perhaps didn't need to be used at all. That's where energy
            vampires get interesting, not as the whole brand but as a human way of asking what in my home is
            quietly taking electricity without giving me much back.
          </p>

          <p>
            Standby is the obvious example, but the more useful discoveries are often less theatrical: an old
            second fridge, heating equipment behaving strangely, a device running all day, or background
            consumption that has quietly increased.
          </p>

          <p>
            Half-hourly smart-meter data won't tell us the make and model of every appliance in your house, and
            we shouldn't pretend it will. What it can do is reveal patterns — the product can say that something
            appears to be using electricity here, but it should always distinguish that inference from something
            actually measured at device level. That distinction matters.
          </p>

          <h2>One saving, three causes</h2>

          <p>
            There are three fundamentally different ways your bill might improve. The tariff effect is the same
            electricity on a different tariff. The timing effect is the same amount of electricity used at
            different times. The waste effect is electricity you don't need to use at all.
          </p>

          <p>
            We keep these effects separate, which means no double counting. We won't claim a tariff created a
            saving that really came from moving an appliance, or that moving an appliance saved electricity when
            it only changed when the electricity was used. You should be able to see exactly what caused every
            number.
          </p>

          <h2>Useful truth beats exciting numbers</h2>

          <p>
            That principle goes beyond tariff comparison. Energy products can produce impressive figures if they
            quietly multiply everything by 365 — save 12p today and suddenly it's £43.80 a year, except that it
            only becomes £43.80 if the same thing happens every single day. If we annualise a saving, we say
            what assumption produced it.
          </p>

          <p>
            The same applies everywhere else: we want every important number to have a provenance. It's either
            measured (directly observed in your data), inferred (something the pattern suggests), modelled (a
            scenario we've calculated), or verified (we have evidence it actually happened). These words may not
            always dominate the interface, but the distinction should always exist. We'd rather show a small
            number we can defend than a large one we can't.
          </p>

          <h2>You can already do some of this elsewhere</h2>

          <p>
            This isn't an argument that energy suppliers are doing something wrong. The Octopus app already
            gives its customers useful information about their usage, bills and tariffs, and other apps already
            help people compare Octopus tariffs against their consumption. Those products have their own jobs.
            Ours is slightly different — we want to sit on the user's side of the meter.
          </p>

          <p>
            That means being able to say your existing tariff is already a good fit, or that you could
            technically save money here but it probably isn't worth changing your routine for, or simply that
            nothing needs doing. No outcome should be commercially better for us than another — that
            independence is part of the product, not just the marketing.
          </p>

          <p>
            We're starting with Octopus because it gives customers a practical way to access their own
            consumption and tariff data. The product itself shouldn't become an Octopus companion. Over time,
            the principle should be broader: compare the structures that genuinely fit the household, whoever
            supplies them.
          </p>

          <p className="vision-prose__scope-note">
            Everything above is what Shift &amp; Save does today. What follows is direction, not a feature list
            — none of it is built yet, and none of it is a promise.
          </p>

          <h2>Use the technology you already own</h2>

          <p>
            A lot of homes already have bits of smart technology — a smart plug bought a year ago and barely
            used, a dishwasher with its own app, a washing machine with delayed start, a tumble dryer with timer
            controls. The capability is often already there. The problem is that each device has its own
            controls, its own app, its own terminology.
          </p>

          <p>
            We don't want to become another smart-home control panel, but we do want to help people make better
            use of what they already have. If running your dishwasher at a different time is genuinely
            worthwhile, the next useful step may simply be showing you how to do that with the dishwasher you
            already own — or, if you have a smart plug that can automate it, how to set that up. Eventually, we
            might offer to handle that part for you.
          </p>

          <p>
            That gives integrations a clear role: we won't connect everything just because integrations are
            exciting. The product should prefer existing capability to asking someone to buy new hardware. We're
            not trying to be the app for your dishwasher — we're trying to tell you when your dishwasher app is
            worth bothering with.
          </p>

          <h2>The small numbers are actually the interesting part</h2>

          <p>
            Most individual energy savings aren't dramatic, and we're not interested in pretending otherwise.
            But small things repeated become something different. Ten pence once is ten pence; ten pence
            repeatedly is a pattern, and once you understand a pattern you can decide whether it's worth doing
            something about. That's the idea behind small changes, bigger consequences — the first job is making
            the small change visible and credible.
          </p>

          <p>
            Longer term, there's a more interesting question about what that accumulated value could mean
            somewhere else — a savings goal, a mortgage overpayment, a charitable donation. Thousands of
            households shifting small amounts of electricity away from peak periods might add up to something
            meaningful collectively. Those are directions, not promises: the product has to earn the right to go
            there by getting the underlying energy calculation right first.
          </p>

          <p>
            A projected saving isn't money in the bank. A projected mortgage consequence isn't interest saved
            unless the overpayment actually happens, and a charitable impact isn't real because an app draws a
            heart next to £5. The further we move from the smart meter, the more important it becomes to explain
            how we got there.
          </p>

          <h2>Eventually, the best energy app may be one you barely open</h2>

          <p>
            The first version asks you to explore — look at your usage, compare, move things around and see what
            happens. That shouldn't be the permanent experience. If the product understands your household well
            enough, it should gradually require less attention: tell you when something important changes, when
            a tariff becomes materially better, when background consumption suddenly increases, or when a
            genuinely useful cheap period appears. When there's nothing worth acting on, it shouldn't manufacture
            a notification. There's no prize for time spent inside an energy app.
          </p>

          <p>
            The longer-term direction is to understand it for me, then tell me what matters, then help me act,
            and eventually handle the useful parts for me. The technology underneath may become more
            sophisticated, but the experience itself should become quieter.
          </p>

          <h2>What we're trying to build</h2>

          <p>
            The vision isn't really an energy dashboard or a tariff comparison site. It's a quiet layer between
            complicated electricity data and an ordinary household, able to answer a handful of questions: what
            am I paying for? Would another tariff actually suit me? Is anything worth moving or being wasted? Is
            any of this significant enough to care about?
          </p>

          <p>
            Sometimes the answer will be yes and sometimes it will be no, and both are useful. The goal isn't to
            make everybody optimise everything. It's to help people understand where their electricity money is
            going, know what's worth changing, and ignore what isn't.
          </p>

          <p className="vision-prose__closing">
            Small changes. Bigger consequences. Not because every penny is life-changing, but because when the
            small stuff genuinely adds up, you should be able to see it.
          </p>

          <p className="vision-prose__independence">Shift &amp; Save is independent of Octopus Energy.</p>
        </article>
      </div>

      <PublicFooter />
    </>
  )
}

export default VisionPage

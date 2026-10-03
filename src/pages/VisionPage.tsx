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
            leaves the account. We might know roughly whether we've used more or less than last month, but very
            few of us can answer some basic questions. What am I actually paying for? Would a different tariff
            suit the way my household really uses electricity? Is there anything worth changing, and if there
            is, is the saving worth the inconvenience?
          </p>

          <p>
            Energy has become more complicated. Smart meters can record consumption every half hour, some
            tariffs change price through the day, and cars, batteries and appliances can increasingly decide
            when to use electricity. That should make good decisions easier, but too often it has only created
            more data.
          </p>

          <p>
            We think the useful product is the layer in between. It isn't another dashboard full of graphs, a
            tariff marketplace trying to persuade you that switching is always the answer, or a smart-home
            controller trying to optimise every minute of your life. It is a clearer answer to a simple
            question: what is worth doing about my electricity, if anything?
          </p>

          <h2>Sometimes the answer should be "nothing"</h2>

          <p>
            When you build a product around saving money, there is an obvious temptation to always find a
            saving. Move the dishwasher, change tariff, run something at 2am, turn another device off, or
            annualise 11p into a much more impressive-looking number.
          </p>

          <p>
            But sometimes your current tariff already suits you. Sometimes moving an appliance saves so little
            that it isn't worth thinking about, or the cheapest possible time is an absurd time to ask a real
            household to do something. And sometimes there simply isn't much waste to find. Those aren't bad
            results. They're useful answers, and we would rather tell you to stay where you are than manufacture
            a reason for you to change.
          </p>

          <p>
            That is one of the principles behind what we're building: education before persuasion. No tariff
            needs to win, no supplier needs to win, and no action needs to happen. The user needs to understand
            the decision.
          </p>

          <h2>Start with your electricity, not somebody else's average</h2>

          <p>
            A lot of energy advice begins with the typical household, with its typical consumption, appliances,
            savings and behaviour. But you don't live in a typical household. You live in yours, so the useful
            starting point is your actual pattern of electricity use.
          </p>

          <p>
            For Octopus Energy customers, the first version will use the half-hourly consumption data available
            through their account, together with their tariff information. We only need read access. We don't
            need to change your tariff or control your account. The result should be much more concrete than an
            average: this is what your electricity use cost on this tariff.
          </p>

          <p>
            If you don't want to connect anything yet, you can still explore the product using a clearly
            labelled representative household. The important thing is never to blur the two. A model is a
            model, and your data is your data.
          </p>

          <h2>Compare the same household</h2>

          <p>
            Tariff comparisons can become misleading surprisingly quickly. Change the tariff, the household
            assumptions, when appliances run and the amount of electricity used, then present the final number
            as though the tariff alone created the difference.
          </p>

          <p>
            We want to do the opposite. We take exactly the same electricity use, with the same household,
            half-hours, kWh and events, and price it on another tariff. Only the tariff changes. If the result
            is cheaper, you can see why. If it's more expensive, you can see that too. If it's basically the
            same, that's useful information. There doesn't need to be a winner.
          </p>

          <h2>Then ask whether timing matters</h2>

          <p>
            Changing tariff and changing behaviour are different things, and we keep them separate. Once you've
            looked at the tariff itself, we can ask whether any of this electricity could realistically have
            been used at a cheaper time.
          </p>

          <p>
            The word "realistically" is doing a lot of work there, because the mathematically cheapest answer
            isn't necessarily the useful one. A washing machine might technically be cheapest at two in the
            morning, but that doesn't make two in the morning a sensible recommendation. People sleep,
            appliances take time, some things need supervision, and households have routines. Dinner happens
            around dinner time for a reason.
          </p>

          <p>
            So the aim isn't to find the cheapest possible half-hour. It is to find the cheapest practical
            option for this household. When we reject a cheaper period, we should be able to tell you why.
          </p>

          {/* OA-168: "Hunt the energy vampires in your home" moves here
              from the homepage hero (OA-111/OA-168) -- feature-level
              language for waste detection specifically, not the whole
              product's master proposition any more. */}
          <h2>Hunt the energy vampires in your home</h2>

          <p>
            There's a third category, different again: waste. This isn't electricity used on the wrong tariff or at
            the wrong time. It is electricity that perhaps didn't need to be used in the first place. That's
            where energy vampires become interesting, not as the whole brand but as a human way of asking what
            in my home is quietly taking electricity without giving me much back.
          </p>

          <p>
            Standby is the obvious example, but the more useful discoveries are often less theatrical: an old
            second fridge, heating equipment behaving strangely, a device running all day, or background
            consumption that has quietly increased.
          </p>

          <p>
            Half-hourly smart-meter data won't tell us the make and model of every appliance in your house, and
            we shouldn't pretend that it will. What it can do is reveal patterns. The product can say that
            something appears to be using electricity here, and it should distinguish that inference from
            something measured at device level. That distinction matters.
          </p>

          <h2>One saving, three causes</h2>

          <p>
            There are three fundamentally different ways your bill might improve. The tariff effect is the same
            electricity on a different tariff. The timing effect is the same amount of electricity used at
            different times. The waste effect is electricity you don't need to use at all.
          </p>

          <p>
            We keep these effects separate, which means no double counting. We won't claim that a tariff created
            a saving that really came from moving an appliance, or that moving an appliance saved electricity
            when it only changed when the electricity was used. You should be able to see exactly what caused
            every number.
          </p>

          <h2>Useful truth beats exciting numbers</h2>

          <p>
            That principle goes beyond tariff comparison. Energy products can produce impressive figures if they
            quietly multiply everything by 365. Save 12p today and suddenly it's £43.80 a year, except that it
            only becomes £43.80 if the same thing happens every single day. If we annualise a saving, we should
            say what assumption produced it.
          </p>

          <p>
            The same applies everywhere else. We want every important number to have a provenance. It is either
            measured, meaning directly observed in your data, or inferred, meaning something the pattern
            suggests. It might be modelled, meaning a scenario we've calculated, or verified, meaning we have
            evidence it actually happened. These words may not always dominate the interface, but the
            distinction should always exist. We would rather show a small number we can defend than a large
            number we can't.
          </p>

          <h2>You can already do some of this elsewhere</h2>

          <p>
            This isn't an argument that energy suppliers are doing something wrong. The Octopus app already
            gives its customers useful information about their usage, bills and tariffs, and other apps already
            help people compare Octopus tariffs against their consumption. Those products have their own jobs.
            Ours is slightly different, because we want to sit on the user's side of the meter.
          </p>

          <p>
            That means being able to say that your existing tariff is already a good fit, or that you could
            technically save money here but it probably isn't worth changing your routine for, or simply that
            nothing needs doing. No outcome should be commercially better for us than another. That independence
            is part of the product, not just part of the marketing.
          </p>

          <p>
            We are starting with Octopus because it gives customers a practical way to access their own
            half-hourly consumption and tariff data. The product itself shouldn't become an Octopus companion.
            Over time, the principle should be broader: compare the structures that genuinely fit the household,
            whoever supplies them.
          </p>

          <h2>Use the technology you already own</h2>

          <p>
            A lot of homes already have bits of smart technology. There may be a smart plug bought a year ago
            and barely used, a dishwasher with its own app, a washing machine with delayed start, a tumble
            dryer with timer controls, or a heater already connected to a plug timer. The problem is often not
            that the capability is missing. It is that each device has its own controls, its own app, its own
            terminology and its own idea of what the user should do.
          </p>

          <p>
            We don't want to become another smart-home control panel, but we do want to help people make better
            use of the technology they already have. If we can see that running your dishwasher at a different
            time is genuinely worthwhile, the next useful step may simply be to show you how to do that with the
            dishwasher you already own. If you have a smart plug that can automate it, we can show you how to
            set it up. Eventually, we might offer to handle that useful part for you.
          </p>

          <p>
            That gives integrations a clear role. We won't connect everything because integrations are
            exciting. When there is a worthwhile action, we will help the user carry it out with the tools they
            already have, and the product should prefer existing capability to asking someone to buy new
            hardware. We are not trying to be the app for your dishwasher. We are trying to tell you when your
            dishwasher app is worth bothering with.
          </p>

          <h2>The small numbers are actually the interesting part</h2>

          <p>
            Most individual energy savings aren't dramatic, and we're not interested in pretending otherwise.
            But small things repeated become something different. Ten pence once is ten pence, while ten pence
            repeatedly is a pattern, and once you can understand a pattern you can decide whether it is worth
            doing something about. That's the idea behind small changes, bigger consequences. The first job is
            to make the small change visible and credible.
          </p>

          <p>
            Longer term, there is a more interesting question about what that accumulated value could mean
            somewhere else. It might contribute to a savings goal or become a mortgage overpayment, or somebody
            might choose to donate it. Thousands of households shifting small amounts of electricity away from
            peak periods might add up to something meaningful collectively. Those are directions, not promises.
            The product has to earn the right to go there by getting the underlying energy calculation right
            first.
          </p>

          <p>
            A projected saving isn't money in the bank. A projected mortgage consequence isn't interest saved
            unless the overpayment actually happens, and a charitable impact isn't real because an app draws a
            heart next to £5. The further we move from the smart meter, the more important it becomes to
            explain how we got there.
          </p>

          <h2>Eventually, the best energy app may be one you barely open</h2>

          <p>
            The first version asks you to explore. You look at your usage, compare, move things around and see
            what happens. That shouldn't be the permanent experience. If the product understands your household
            well enough, it should gradually require less attention. It should tell you when something important
            changes, when a tariff becomes materially better for the way you use electricity, when your
            background consumption suddenly increases, or when a genuinely useful cheap period appears. When
            there is nothing worth acting on, it shouldn't manufacture a notification. There is no prize for
            time spent inside an energy app.
          </p>

          <p>
            The longer-term direction is to understand it for me, then tell me what matters, then help me act,
            and eventually handle the useful parts for me. The technology underneath may become increasingly
            sophisticated, but the experience itself should become quieter.
          </p>

          <h2>What we're trying to build</h2>

          <p>
            The vision isn't really an energy dashboard or a tariff comparison site. It is a quiet layer between
            complicated electricity data and an ordinary household. It should be able to answer a handful of
            questions. What am I paying for? Would another tariff actually suit me? Is there anything worth
            moving? Is anything being wasted? And is any of this significant enough to care about?
          </p>

          <p>
            Sometimes the answer will be yes and sometimes it will be no, and both are useful. The goal isn't to
            make everybody optimise everything. It is to help people understand where their electricity money is
            going, know what is worth changing, and ignore what isn't.
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

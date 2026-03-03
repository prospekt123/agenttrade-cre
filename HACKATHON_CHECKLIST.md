# Chainlink Convergence Hackathon - Submission Checklist

**Project**: AgentTrade  
**Track**: CRE & AI  
**Deadline**: March 1, 2026  
**Days Remaining**: 9

## ✅ Completed (MVP Phase)

- [x] Project structure created
- [x] CRE workflow implemented
- [x] Chainlink Data Feeds integrated
- [x] Trading signal strategies (momentum + mean reversion)
- [x] AI agent decision engine
- [x] Build scripts (WASM compilation)
- [x] Simulation scripts
- [x] Deployment scripts
- [x] TypeScript configuration
- [x] Package dependencies
- [x] README.md (comprehensive)
- [x] SETUP.md (detailed guide)
- [x] QUICK_START.md (5-min guide)
- [x] docs/architecture.md (technical details)
- [x] docs/demo-script.md (video script)
- [x] docs/CHAINLINK_USAGE.md (all integrations)
- [x] HACKATHON_SUBMISSION.md (template)
- [x] CONTRIBUTING.md
- [x] LICENSE (MIT)
- [x] .gitignore
- [x] .env.example

## 🔄 In Progress (Setup Phase)

### Today (Feb 20)

- [ ] Install Bun
  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```

- [ ] Install dependencies
  ```bash
  cd /home/moltbot/clawd/chainlink-project
  bun install
  ```

- [ ] Install CRE CLI
  - Visit: https://docs.chain.link/cre/getting-started/cli-installation
  - Download for your platform
  - Verify: `cre --version`

- [ ] Create CRE account
  - Visit: https://cre.chain.link
  - Sign up
  - Verify email
  - Save credentials

- [ ] Configure environment
  ```bash
  cp .env.example .env
  # Edit .env with CRE credentials
  ```

### Feb 21-22 (Testing)

- [ ] Build workflow
  ```bash
  bun run build
  ```

- [ ] Run simulation
  ```bash
  bun run simulate
  ```
  - Verify it fetches real ETH/USD price
  - Verify it generates trading signals
  - Save output for demo video

- [ ] Test AI agent
  ```bash
  bun run agent
  ```
  - Verify decision making works
  - Check portfolio tracking
  - Save example output

- [ ] Test with different market conditions
  - Run simulation multiple times
  - Observe different signals (BUY/SELL/HOLD)
  - Document interesting examples

- [ ] Optional: Request CRE Early Access
  - Visit: https://cre.chain.link/request-access
  - Submit project details
  - Wait for approval (not required for submission)

### Feb 23-24 (Demo Video)

- [ ] Prepare recording environment
  - Clean terminal
  - Increase font size
  - Test screen recording
  - Test audio

- [ ] Record demo video (follow docs/demo-script.md)
  - Introduction (30s)
  - Architecture overview (45s)
  - Code walkthrough (90s)
  - Live demo (60s)
  - Conclusion (15s)
  - **Total: 3-5 minutes**

- [ ] Review recording
  - Check audio quality
  - Verify all demos work
  - Edit if needed

- [ ] Upload to YouTube
  - Public or unlisted
  - Add title: "AgentTrade - Chainlink Convergence Hackathon 2026"
  - Add description with GitHub link
  - Save YouTube URL

### Feb 25-26 (GitHub & Polish)

- [ ] Create GitHub repository
  ```bash
  cd /home/moltbot/clawd/chainlink-project
  git init
  git add .
  git commit -m "Initial commit - AgentTrade for Chainlink Hackathon"
  ```

- [ ] Push to GitHub
  ```bash
  # Create repo on GitHub first (public)
  git remote add origin https://github.com/yourusername/agenttrade.git
  git push -u origin main
  ```

- [ ] Verify repo is PUBLIC

- [ ] Update HACKATHON_SUBMISSION.md
  - Add GitHub URL
  - Add YouTube video URL
  - Add your contact info
  - Add team information

- [ ] Polish README.md
  - Add demo video link
  - Add live demo link (if deployed)
  - Add badges (optional)
  - Fix any typos

- [ ] Test installation from scratch
  - Clone your repo
  - Follow SETUP.md
  - Verify everything works

### Feb 27-28 (Final Review)

- [ ] Code review
  - Check all TypeScript compiles
  - Fix any linter warnings
  - Add missing comments
  - Verify Chainlink integrations are clear

- [ ] Documentation review
  - Read all .md files
  - Fix typos
  - Verify all links work
  - Ensure Chainlink usage is well-documented

- [ ] Test all commands
  ```bash
  bun install          # ✓ Works
  bun run typecheck    # ✓ No errors
  bun run build        # ✓ Compiles
  bun run simulate     # ✓ Runs
  bun run agent        # ✓ Executes
  ```

- [ ] Prepare submission form
  - Project name: AgentTrade
  - Track: CRE & AI
  - GitHub URL: [your-repo]
  - Video URL: [your-youtube]
  - Description: See HACKATHON_SUBMISSION.md

### March 1 (Submission Day)

- [ ] Final git push
  ```bash
  git add .
  git commit -m "Final polish before submission"
  git push
  ```

- [ ] Verify GitHub repo
  - All files present
  - README looks good
  - Links work

- [ ] Verify demo video
  - Plays correctly
  - Audio clear
  - Shows all required elements

- [ ] Submit to hackathon
  - Fill out official submission form
  - Include all required information
  - Double-check all URLs
  - **SUBMIT BEFORE DEADLINE**

- [ ] Confirmation
  - Save submission confirmation
  - Tweet about submission (optional)
  - Share in Discord (optional)

## 📋 Submission Requirements (All Must Be Checked)

### Code Requirements

- [ ] All code written during Feb 6 - Mar 1, 2026
- [ ] No copied code from previous projects
- [ ] Original implementation for hackathon

### Chainlink Requirements

- [ ] Uses CRE as orchestration layer
- [ ] Integrates blockchain with external data
- [ ] Successfully simulates with CRE CLI
- [ ] (Optional) Deployed to CRE DON

### Documentation Requirements

- [ ] Public GitHub repository
- [ ] README linking all Chainlink usage
- [ ] Clear setup instructions
- [ ] Code comments where needed

### Demo Requirements

- [ ] 3-5 minute publicly viewable video
- [ ] Shows project working
- [ ] Explains Chainlink integration
- [ ] Uploaded to YouTube/Vimeo

### Submission Form

- [ ] Project name
- [ ] Track selection (CRE & AI)
- [ ] GitHub URL
- [ ] Video URL
- [ ] Team information
- [ ] Contact email
- [ ] Project description

## 🎯 Success Criteria

**Minimum (Required for Submission)**:
- ✅ MVP complete
- ✅ Simulation works
- ✅ Documentation complete
- [ ] Video recorded
- [ ] GitHub repo public
- [ ] Submitted before March 1

**Nice to Have**:
- [ ] Deployed to CRE DON
- [ ] Multiple trading strategies
- [ ] LLM integration
- [ ] x402 payments
- [ ] DEX integration

**Winning Project**:
- Clear demonstration of CRE + AI
- Production-ready architecture
- Innovative use case
- Complete documentation
- Polished demo video

## 📊 Progress Tracker

- **MVP**: ✅ 100% Complete (Feb 20)
- **Setup**: ⏳ 0% Complete (Feb 20-22)
- **Testing**: ⏳ 0% Complete (Feb 21-22)
- **Demo Video**: ⏳ 0% Complete (Feb 23-24)
- **GitHub**: ⏳ 0% Complete (Feb 25-26)
- **Final Review**: ⏳ 0% Complete (Feb 27-28)
- **Submission**: ⏳ 0% Complete (March 1)

**Overall Progress**: 14% (MVP Complete)

## 🚨 Critical Path Items

These MUST be done to submit:

1. **CRE CLI Installation** - Can't build/simulate without it
2. **Bun Installation** - Can't run project without it
3. **Demo Video** - Required for submission
4. **GitHub Repo** - Must be public and accessible
5. **Submission Form** - Must be completed before deadline

## 📞 Help & Resources

- **CRE Docs**: https://docs.chain.link/cre
- **Hackathon Discord**: Chainlink Convergence server
- **Office Hours**: Feb 17-27 (check schedule)
- **Support**: Submit ticket at cre.chain.link

## 💡 Tips

1. **Test early**: Don't wait until the last day to install CRE CLI
2. **Record multiple takes**: Demo video doesn't have to be perfect on first try
3. **Keep it simple**: Working demo > complex features
4. **Document everything**: Judges need to understand your project
5. **Ask for help**: Use Discord and office hours if stuck

---

**Last Updated**: Feb 20, 2026  
**Next Milestone**: Install CRE CLI and Bun (Feb 20-21)  
**Days to Deadline**: 9

(() => {
  const sb = window.supabase?.createClient?.(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const fmtDate = d => d ? new Date(String(d).length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('en-LK',{day:'2-digit',month:'short',year:'numeric'}) : '';
  const fmtTime = d => d ? new Date(d).toLocaleTimeString('en-LK',{hour:'numeric',minute:'2-digit'}) : '';
  const classes = ['Grade 6','Grade 7','Grade 8','Grade 9','Grade 10','Grade 11','Rapid Revision 2026'];
  const storage = sb?.storage;

  async function studentEnhance(){
    if (!document.querySelector('#dashboard-content') || !sb) return;
    const {data:{session}} = await sb.auth.getSession(); if(!session) return;
    const {data:profile} = await sb.from('students').select('student_id,full_name').eq('user_id',session.user.id).single(); if(!profile) return;
    const {data:access,error:accessError} = await sb.rpc('get_my_class_access');
    if(accessError) console.error(accessError);
    const active = (access||[]).filter(x=>x.active).map(x=>x.class_name);
    const locked = (access||[]).filter(x=>!x.active).map(x=>x.class_name);
    const accessGrid = document.querySelector('#access-grid');
    if(accessGrid) accessGrid.innerHTML = (access||[]).map(x => `<div class="access-card ${x.active?'':'access-locked'}"><span>${x.active?'ACCESS ACTIVE':'ACCESS SUSPENDED'}</span><strong>${esc(x.class_name)}</strong><small>${x.reason==='payment_required'?'Payment required after the 14th.':x.reason==='paid'?'Payment verified.':x.reason==='manual_override'?'Teacher override enabled.':'Access available.'}</small></div>`).join('') || '<div class="empty-state">No class access assigned yet.</div>';
    if(accessError){
      document.querySelector('#recordings-list')?.replaceChildren();
      document.querySelector('#recordings-list')?.insertAdjacentHTML('beforeend','<div class="empty-state">Unable to check class access. Please refresh or contact the teacher.</div>');
      return;
    }
    const {data:resources} = active.length ? await sb.from('resources').select('*').in('class_name',active).order('resource_date',{ascending:false}).order('created_at',{ascending:false}) : {data:[]};
    if(resources){
      const render = async r => {
        let href = r.url || '#', label = r.type==='recording' ? 'Watch Recording ↗' : 'Open Resource ↗';
        if(r.file_path && storage){ const {data:signed} = await storage.from('study-materials').createSignedUrl(r.file_path, 900); if(signed?.signedUrl){href=signed.signedUrl;label='Download PDF ↓';} }
        return `<a class="resource-row" href="${esc(href)}" target="_blank" rel="noopener"><div class="resource-icon">${r.type==='recording'?'▶':'↗'}</div><div><strong>${esc(r.title)}</strong><span>${esc(r.class_name)} · ${esc(fmtDate(r.resource_date))}${r.description?' · '+esc(r.description):''}</span></div><b>${label}</b></a>`;
      };
      const rows = await Promise.all(resources.map(render));
      const rec = rows.filter((_,i)=>resources[i].type==='recording').join('');
      const mat = rows.filter((_,i)=>resources[i].type!=='recording').join('');
      document.querySelector('#recordings-list') && (document.querySelector('#recordings-list').innerHTML = rec || '<div class="empty-state">No recordings available yet.</div>');
      document.querySelector('#materials-list') && (document.querySelector('#materials-list').innerHTML = mat || '<div class="empty-state">No study materials available yet.</div>');
      document.querySelector('#latest-resources') && (document.querySelector('#latest-resources').innerHTML = rows.slice(0,5).join('') || '<div class="empty-state">No resources available yet.</div>');
    }
    const {data:schedule} = active.length ? await sb.from('class_schedule').select('*').in('class_name',active).gte('starts_at',new Date().toISOString()).order('starts_at',{ascending:true}).limit(5) : {data:[]};
    const scheduleBox = document.querySelector('#schedule-box');
    if(scheduleBox) scheduleBox.innerHTML = (schedule||[]).map(x=>`<div class="schedule-card"><span class="eyebrow">${esc(x.class_name)}</span><h2>${esc(x.title)}</h2><p>${fmtDate(x.starts_at)} · ${fmtTime(x.starts_at)}${x.ends_at?' – '+fmtTime(x.ends_at):''}</p>${x.description?`<p>${esc(x.description)}</p>`:''}${x.zoom_url?`<a class="btn btn-primary" href="${esc(x.zoom_url)}" target="_blank" rel="noopener">Join Zoom ↗</a>`:''}</div>`).join('') || '<div class="empty-state">No upcoming classes scheduled yet.</div>';
    const overview = document.querySelector('#tab-overview');
    if(overview){ document.querySelector('#payment-access-notice')?.remove(); const n=document.createElement('div'); n.id='payment-access-notice'; n.className='portal-notice'; n.innerHTML=locked.length?`<strong>Payment access notice</strong><span>${esc(locked.join(', '))} ${locked.length===1?'class is':'classes are'} currently suspended because the monthly payment has not been verified.</span>`:'<strong>Access active</strong><span>Your assigned classes are currently available.</span>'; overview.prepend(n); }
  }

  async function callAdmin(action,payload){
    const {data:{session}}=await sb.auth.getSession(); if(!session) throw new Error('Please log in again.');
    const {data,error}=await sb.functions.invoke('admin-student-management',{body:{action,...payload}}); if(error) throw error; if(data?.error) throw new Error(data.error); return data;
  }

  async function adminEnhance(){
    if(!document.querySelector('#admin-enhanced') || !sb) return;
    const {data:{session}}=await sb.auth.getSession(); if(!session){location.href='login.html';return;}
    const {data:me,error:meError}=await sb.from('students').select('role').eq('user_id',session.user.id).single();
    if(meError || me?.role!=='admin'){location.href='login.html';return;}
    const status = document.querySelector('#admin-status');
    const say = (msg,bad=false)=>{if(status){status.textContent=msg;status.className='form-status '+(bad?'error':'success');}};
    const classOptions = classes.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
    document.querySelector('#student-class-list').innerHTML=classes.map(c=>`<label class="check-row"><input type="checkbox" value="${esc(c)}">${esc(c)}</label>`).join('');
    document.querySelector('#resource-class').innerHTML=classOptions; document.querySelector('#schedule-class').innerHTML=classOptions;

    async function refresh(){
      const [studentsRes,paymentsRes,resourcesRes,schedulesRes] = await Promise.all([
        sb.from('students').select('student_id,full_name,role,created_at').order('created_at',{ascending:false}),
        sb.from('payments').select('*').order('created_at',{ascending:false}).limit(50),
        sb.from('resources').select('*').order('resource_date',{ascending:false}).order('created_at',{ascending:false}).limit(30),
        sb.from('class_schedule').select('*').order('starts_at',{ascending:true}).limit(30)
      ]);
      if(studentsRes.error) throw studentsRes.error;
      document.querySelector('#admin-students').innerHTML=(studentsRes.data||[]).map(s=>`<div class="admin-list-row"><div><strong>${esc(s.full_name)}</strong><span>${esc(s.student_id)} · ${esc(s.role)}</span></div>${s.role==='student'?`<div class="admin-actions"><button class="btn btn-small reset-student" data-id="${esc(s.student_id)}">Reset PW</button><button class="btn btn-small delete-student" data-id="${esc(s.student_id)}">Remove</button></div>`:''}</div>`).join('')||'<div class="empty-state">No students yet.</div>';
      if(paymentsRes.error) throw paymentsRes.error;
      const payments=paymentsRes.data||[];
      document.querySelector('#admin-payments').innerHTML=payments.map(p=>`<div class="admin-list-row"><div><strong>${esc(p.student_id)} · ${esc(p.class_name)}</strong><span>${esc(p.month)} · LKR ${Number(p.amount||0).toLocaleString('en-LK')}</span></div><div class="admin-actions"><span class="status-pill ${esc(p.status)}">${esc(p.status)}</span>${p.slip_path?`<button class="btn btn-small view-slip" data-path="${esc(p.slip_path)}">View Slip</button>`:''}${p.status==='pending'?`<button class="btn btn-small verify-payment" data-id="${esc(p.id)}" data-status="verified">Verify</button><button class="btn btn-small reject-payment" data-id="${esc(p.id)}" data-status="rejected">Reject</button>`:''}</div></div>`).join('')||'<div class="empty-state">No payments yet.</div>';
      if(resourcesRes.error) throw resourcesRes.error;
      document.querySelector('#admin-resources').innerHTML=(resourcesRes.data||[]).map(r=>`<div class="admin-list-row"><div><strong>${esc(r.title)}</strong><span>${esc(r.class_name)} · ${esc(r.type)} · ${esc(fmtDate(r.resource_date))}</span></div><button class="btn btn-small delete-resource" data-id="${esc(r.id)}" data-path="${esc(r.file_path||'')}">Delete</button></div>`).join('')||'<div class="empty-state">No resources yet.</div>';
      if(schedulesRes.error) throw schedulesRes.error;
      document.querySelector('#admin-schedules').innerHTML=(schedulesRes.data||[]).map(x=>`<div class="admin-list-row"><div><strong>${esc(x.title)}</strong><span>${esc(x.class_name)} · ${fmtDate(x.starts_at)} · ${fmtTime(x.starts_at)}</span></div><button class="btn btn-small delete-schedule" data-id="${esc(x.id)}">Delete</button></div>`).join('')||'<div class="empty-state">No schedules yet.</div>';
    }

    document.querySelector('#student-form').addEventListener('submit',async e=>{e.preventDefault();try{say('Creating student…');const fd=new FormData(e.target);const selected=[...document.querySelectorAll('#student-class-list input:checked')].map(x=>x.value);if(!selected.length)throw new Error('Select at least one class.');await callAdmin('create_student',{student_id:fd.get('student_id'),full_name:fd.get('full_name'),password:fd.get('password'),classes:selected});say('Student created successfully.');e.target.reset();document.querySelectorAll('#student-class-list input').forEach(x=>x.checked=false);await refresh();}catch(err){say(err.message||'Could not create student.',true);}});

    document.querySelector('#resource-form').addEventListener('submit',async e=>{e.preventDefault();try{say('Publishing resource…');const fd=new FormData(e.target);const type=fd.get('type');let filePath=null,url=String(fd.get('url')||'').trim();const file=fd.get('file');if(type==='material' && (!file || !file.size) && !url) throw new Error('Upload a PDF or provide a resource link.');if(file && file.size){if(file.type!=='application/pdf')throw new Error('Only PDF files are allowed.');if(file.size>15*1024*1024)throw new Error('PDF must be 15 MB or smaller.');filePath=`${fd.get('class_name')}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;const up=await storage.from('study-materials').upload(filePath,file,{upsert:false,contentType:'application/pdf'});if(up.error)throw up.error;}const {error}=await sb.from('resources').insert({class_name:fd.get('class_name'),title:fd.get('title'),description:fd.get('description'),type,resource_date:fd.get('resource_date'),url:url||null,file_path:filePath,file_name:file?.name||null});if(error){if(filePath)await storage.from('study-materials').remove([filePath]);throw error;}say('Resource published.');e.target.reset();await refresh();}catch(err){say(err.message||'Could not publish resource.',true);}});

    document.querySelector('#schedule-form').addEventListener('submit',async e=>{e.preventDefault();try{say('Publishing class schedule…');const fd=new FormData(e.target);const start=new Date(`${fd.get('date')}T${fd.get('start')}:00+05:30`).toISOString();const end=fd.get('end')?new Date(`${fd.get('date')}T${fd.get('end')}:00+05:30`).toISOString():null;if(new Date(start).getTime()<Date.now())throw new Error('Choose a future class date/time.');const {error}=await sb.from('class_schedule').insert({class_name:fd.get('class_name'),title:fd.get('title'),description:fd.get('description'),starts_at:start,ends_at:end,zoom_url:fd.get('zoom_url')||null,meeting_id:fd.get('meeting_id')||null,password:fd.get('zoom_password')||null});if(error)throw error;say('Class schedule published.');e.target.reset();await refresh();}catch(err){say(err.message||'Could not publish schedule.',true);}});

    document.addEventListener('click',async e=>{
      const reset=e.target.closest('.reset-student');
      if(reset){const pw=prompt('Enter a new password (8+ characters):');if(!pw)return;try{say('Resetting password…');await callAdmin('reset_password',{student_id:reset.dataset.id,password:pw});say('Password reset successfully.');}catch(err){say(err.message,true);}}
      const delStudent=e.target.closest('.delete-student');
      if(delStudent&&confirm(`Remove student ${delStudent.dataset.id}? This deletes their login account.`)){try{say('Removing student…');await callAdmin('delete_student',{student_id:delStudent.dataset.id});say('Student removed.');await refresh();}catch(err){say(err.message,true);}}
      const vr=e.target.closest('.verify-payment,.reject-payment');
      if(vr&&confirm(`${vr.dataset.status==='verified'?'Verify':'Reject'} this payment?`)){try{say('Updating payment…');const {error}=await sb.from('payments').update({status:vr.dataset.status}).eq('id',vr.dataset.id);if(error)throw error;say(`Payment ${vr.dataset.status}.`);await refresh();}catch(err){say(err.message,true);}}
      const slip=e.target.closest('.view-slip');
      if(slip){try{const {data,error}=await storage.from('payment-slips').createSignedUrl(slip.dataset.path,600);if(error)throw error;if(!data?.signedUrl)throw new Error('Slip could not be opened.');window.open(data.signedUrl,'_blank','noopener');}catch(err){say(err.message,true);}}
      const dr=e.target.closest('.delete-resource');
      if(dr&&confirm('Delete this resource?')){try{say('Deleting resource…');if(dr.dataset.path)await storage.from('study-materials').remove([dr.dataset.path]);const {error}=await sb.from('resources').delete().eq('id',dr.dataset.id);if(error)throw error;say('Resource deleted.');await refresh();}catch(err){say(err.message,true);}}
      const ds=e.target.closest('.delete-schedule');
      if(ds&&confirm('Delete this class schedule?')){try{say('Deleting schedule…');const {error}=await sb.from('class_schedule').delete().eq('id',ds.dataset.id);if(error)throw error;say('Schedule deleted.');await refresh();}catch(err){say(err.message,true);}}
    });
    try{await refresh();}catch(err){say(err.message||'Could not load admin data.',true);}
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>{studentEnhance();adminEnhance()}); else {studentEnhance();adminEnhance();}
})();